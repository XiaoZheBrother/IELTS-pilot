use crate::ai_credentials;
use futures_util::{future::{AbortHandle, Abortable}, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{ipc::Channel, AppHandle, State};

#[derive(Debug, Deserialize, Serialize)]
pub struct AiMessage {
    pub(crate) role: String,
    pub(crate) content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantChatPayload {
    pub(crate) endpoint: String,
    pub(crate) model: String,
    pub(crate) request_id: Option<String>,
    pub(crate) messages: Vec<AiMessage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionPayload {
    endpoint: String,
    model: String,
    api_key: Option<String>,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    prompt_tokens: u64,
    completion_tokens: u64,
    total_tokens: u64,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AssistantStreamEvent {
    Delta { delta: String },
}

#[derive(Default)]
pub struct AssistantStreamState {
    cancellations: Mutex<HashMap<String, AbortHandle>>,
}

pub(crate) struct ParsedStreamData {
    pub(crate) delta: Option<String>,
    pub(crate) model: Option<String>,
    pub(crate) request_id: Option<String>,
    pub(crate) prompt_tokens: Option<u64>,
    pub(crate) completion_tokens: Option<u64>,
    pub(crate) total_tokens: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantChatResponse {
    content: String,
    model: String,
    request_id: String,
    usage: TokenUsage,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResponse {
    ok: bool,
    model: String,
    latency_ms: u64,
}

pub fn validate_assistant_payload(payload: &AssistantChatPayload) -> Result<reqwest::Url, String> {
    let endpoint = reqwest::Url::parse(&payload.endpoint).map_err(|_| "AI endpoint is not a valid URL.".to_string())?;
    if endpoint.scheme() != "https" || !endpoint.username().is_empty() || endpoint.password().is_some() {
        return Err("AI endpoint must use HTTPS.".to_string());
    }
    if payload.model.trim().is_empty() || payload.model.len() > 180 {
        return Err("AI model is missing or too long.".to_string());
    }
    if payload.messages.len() != 2 || payload.messages.iter().any(|message| {
        (message.role != "system" && message.role != "user") || message.content.trim().is_empty() || message.content.chars().count() > 24_000
    }) {
        return Err("Assistant messages are invalid.".to_string());
    }
    Ok(endpoint)
}

fn text(value: &Value) -> Option<String> {
    value.get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn usage(value: &Value, key: &str) -> u64 {
    value.get("usage").and_then(|entry| entry.get(key)).and_then(Value::as_u64).unwrap_or(0)
}

pub(crate) fn parse_stream_data(line: &str) -> Result<Option<ParsedStreamData>, String> {
    let data = line.trim().strip_prefix("data:").map(str::trim).unwrap_or("");
    if data.is_empty() || data == "[DONE]" {
        return Ok(None);
    }
    let value: Value = serde_json::from_str(data).map_err(|_| "AI provider returned invalid stream data.".to_string())?;
    Ok(Some(ParsedStreamData {
        delta: value.get("choices").and_then(Value::as_array).and_then(|choices| choices.first())
            .and_then(|choice| choice.get("delta")).and_then(|delta| delta.get("content"))
            .and_then(Value::as_str).map(ToOwned::to_owned),
        model: value.get("model").and_then(Value::as_str).map(ToOwned::to_owned),
        request_id: value.get("id").and_then(Value::as_str).map(ToOwned::to_owned),
        prompt_tokens: value.get("usage").and_then(|entry| entry.get("prompt_tokens")).and_then(Value::as_u64),
        completion_tokens: value.get("usage").and_then(|entry| entry.get("completion_tokens")).and_then(Value::as_u64),
        total_tokens: value.get("usage").and_then(|entry| entry.get("total_tokens")).and_then(Value::as_u64),
    }))
}

async fn request(
    endpoint: reqwest::Url,
    api_key: &str,
    model: &str,
    messages: &[AiMessage],
    max_tokens: u64,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "Could not initialize the secure AI client.".to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": model,
            "messages": messages,
            "thinking": { "type": "disabled" },
            "temperature": 0.25,
            "max_tokens": max_tokens,
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|error| if error.is_timeout() { "AI provider request timed out.".to_string() } else { "Could not connect to the AI provider.".to_string() })?;
    let status = response.status();
    if !status.is_success() {
        return Err(if status.as_u16() == 429 {
            "AI provider rate limit reached. Please retry later.".to_string()
        } else {
            format!("AI provider returned HTTP {}.", status.as_u16())
        });
    }
    response.json().await.map_err(|_| "AI provider returned invalid JSON.".to_string())
}

#[tauri::command]
pub async fn chat_assistant(app: AppHandle, payload: AssistantChatPayload) -> Result<AssistantChatResponse, String> {
    let endpoint = validate_assistant_payload(&payload)?;
    let api_key = ai_credentials::credential_for_app(&app)?;
    let value = request(endpoint, &api_key, &payload.model, &payload.messages, 1_200).await?;
    let content = text(&value).filter(|content| !content.trim().is_empty()).ok_or_else(|| "AI provider returned no assistant content.".to_string())?;
    Ok(AssistantChatResponse {
        content,
        model: value.get("model").and_then(Value::as_str).unwrap_or(&payload.model).to_string(),
        request_id: value.get("id").and_then(Value::as_str).unwrap_or("desktop-assistant").to_string(),
        usage: TokenUsage {
            prompt_tokens: usage(&value, "prompt_tokens"),
            completion_tokens: usage(&value, "completion_tokens"),
            total_tokens: usage(&value, "total_tokens"),
        },
    })
}

async fn request_stream(
    endpoint: reqwest::Url,
    api_key: &str,
    payload: &AssistantChatPayload,
    on_event: Channel<AssistantStreamEvent>,
) -> Result<AssistantChatResponse, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(90)).build()
        .map_err(|_| "Could not initialize the secure AI client.".to_string())?;
    let response = client.post(endpoint).bearer_auth(api_key).header("Content-Type", "application/json")
        .json(&json!({
            "model": payload.model,
            "messages": payload.messages,
            "thinking": { "type": "disabled" },
            "temperature": 0.25,
            "max_tokens": 1_200,
            "response_format": { "type": "json_object" },
            "stream": true,
            "stream_options": { "include_usage": true }
        }))
        .send().await
        .map_err(|error| if error.is_timeout() { "AI provider request timed out.".to_string() } else { "Could not connect to the AI provider.".to_string() })?;
    let status = response.status();
    if !status.is_success() {
        return Err(if status.as_u16() == 429 { "AI provider rate limit reached. Please retry later.".to_string() }
            else { format!("AI provider returned HTTP {}.", status.as_u16()) });
    }
    let mut stream = response.bytes_stream();
    let mut buffered: Vec<u8> = Vec::new();
    let mut content = String::new();
    let mut model = payload.model.clone();
    let mut request_id = payload.request_id.clone().unwrap_or_else(|| "desktop-assistant-stream".to_string());
    let mut token_usage = TokenUsage::default();
    while let Some(chunk) = stream.next().await {
        buffered.extend_from_slice(&chunk.map_err(|_| "Could not read the AI provider stream.".to_string())?);
        while let Some(position) = buffered.iter().position(|byte| *byte == b'\n') {
            let line = buffered.drain(..=position).collect::<Vec<_>>();
            let line = String::from_utf8(line).map_err(|_| "AI provider stream was not valid UTF-8.".to_string())?;
            if let Some(event) = parse_stream_data(line.trim_end_matches(['\r', '\n']))? {
                if let Some(value) = event.model { model = value; }
                if let Some(value) = event.request_id { request_id = value; }
                if let Some(value) = event.prompt_tokens { token_usage.prompt_tokens = value; }
                if let Some(value) = event.completion_tokens { token_usage.completion_tokens = value; }
                if let Some(value) = event.total_tokens { token_usage.total_tokens = value; }
                if let Some(delta) = event.delta {
                    content.push_str(&delta);
                    on_event.send(AssistantStreamEvent::Delta { delta })
                        .map_err(|_| "Assistant stream was stopped.".to_string())?;
                }
            }
        }
    }
    if !buffered.is_empty() {
        let line = String::from_utf8(buffered).map_err(|_| "AI provider stream was not valid UTF-8.".to_string())?;
        if let Some(event) = parse_stream_data(&line)? {
            if let Some(delta) = event.delta { content.push_str(&delta); on_event.send(AssistantStreamEvent::Delta { delta }).map_err(|_| "Assistant stream was stopped.".to_string())?; }
        }
    }
    if content.trim().is_empty() { return Err("AI provider returned no assistant content.".to_string()); }
    Ok(AssistantChatResponse { content, model, request_id, usage: token_usage })
}

#[tauri::command]
pub async fn chat_assistant_stream(
    app: AppHandle,
    state: State<'_, AssistantStreamState>,
    payload: AssistantChatPayload,
    on_event: Channel<AssistantStreamEvent>,
) -> Result<AssistantChatResponse, String> {
    let endpoint = validate_assistant_payload(&payload)?;
    let api_key = ai_credentials::credential_for_app(&app)?;
    let request_id = payload.request_id.clone().unwrap_or_else(|| "desktop-assistant-stream".to_string());
    let (handle, registration) = AbortHandle::new_pair();
    state.cancellations.lock().map_err(|_| "Assistant cancellation state is unavailable.".to_string())?
        .insert(request_id.clone(), handle);
    let outcome = Abortable::new(request_stream(endpoint, &api_key, &payload, on_event), registration).await;
    state.cancellations.lock().map_err(|_| "Assistant cancellation state is unavailable.".to_string())?.remove(&request_id);
    outcome.map_err(|_| "Assistant stream was stopped.".to_string())?
}

#[tauri::command]
pub fn cancel_assistant_stream(state: State<'_, AssistantStreamState>, request_id: String) -> Result<bool, String> {
    let handle = state.cancellations.lock().map_err(|_| "Assistant cancellation state is unavailable.".to_string())?.remove(&request_id);
    if let Some(handle) = handle { handle.abort(); return Ok(true); }
    Ok(false)
}

#[tauri::command]
pub async fn test_ai_connection(app: AppHandle, payload: TestConnectionPayload) -> Result<ConnectionTestResponse, String> {
    let endpoint = reqwest::Url::parse(&payload.endpoint).map_err(|_| "AI endpoint is not a valid URL.".to_string())?;
    if endpoint.scheme() != "https" || !endpoint.username().is_empty() || endpoint.password().is_some()
        || payload.model.trim().is_empty() || payload.model.len() > 180 {
        return Err("AI endpoint or model is invalid.".to_string());
    }
    let api_key = match payload.api_key {
        Some(value) if !value.trim().is_empty() => {
            ai_credentials::validate_api_key(&value)?;
            value
        }
        _ => ai_credentials::credential_for_app(&app)?,
    };
    let messages = vec![
        AiMessage { role: "system".to_string(), content: "Return JSON only: {\"status\":\"ok\"}.".to_string() },
        AiMessage { role: "user".to_string(), content: "Connection test.".to_string() },
    ];
    let started = Instant::now();
    let value = request(endpoint, &api_key, &payload.model, &messages, 32).await?;
    if text(&value).filter(|content| !content.trim().is_empty()).is_none() {
        return Err("AI provider returned no content during the connection test.".to_string());
    }
    Ok(ConnectionTestResponse {
        ok: true,
        model: value.get("model").and_then(Value::as_str).unwrap_or(&payload.model).to_string(),
        latency_ms: started.elapsed().as_millis() as u64,
    })
}
