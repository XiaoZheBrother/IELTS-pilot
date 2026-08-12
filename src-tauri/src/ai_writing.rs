use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Debug, Deserialize, Serialize)]
pub struct AiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateWritingPayload {
    endpoint: String,
    api_key: String,
    model: String,
    messages: Vec<AiMessage>,
    essay: String,
    prompt: String,
    prompt_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    prompt_tokens: u64,
    completion_tokens: u64,
    total_tokens: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateWritingResponse {
    content: String,
    model: String,
    request_id: String,
    usage: TokenUsage,
}

fn safe_text(value: &Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for key in path {
        current = current.get(key)?;
    }
    current.as_str().map(ToOwned::to_owned)
}

fn safe_number(value: &Value, key: &str) -> u64 {
    value.get("usage").and_then(|usage| usage.get(key)).and_then(Value::as_u64).unwrap_or(0)
}

fn validate_payload(payload: &EvaluateWritingPayload) -> Result<reqwest::Url, String> {
    let endpoint = reqwest::Url::parse(&payload.endpoint).map_err(|_| "AI endpoint is not a valid URL.".to_string())?;
    if endpoint.scheme() != "https" {
        return Err("AI endpoint must use HTTPS.".to_string());
    }
    if payload.api_key.trim().is_empty() || payload.api_key.len() > 512 {
        return Err("AI API key is missing or too long.".to_string());
    }
    if payload.model.trim().is_empty() || payload.model.len() > 180 {
        return Err("AI model is missing or too long.".to_string());
    }
    if payload.prompt_version != "writing-v1" || payload.prompt.len() < 10 || payload.prompt.len() > 4096 {
        return Err("Writing prompt is invalid or unsupported.".to_string());
    }
    if payload.essay.len() < 40 || payload.essay.len() > 20_000 {
        return Err("Essay length is outside the supported range.".to_string());
    }
    if payload.messages.len() != 2 || payload.messages.iter().any(|message| {
        (message.role != "system" && message.role != "user") || message.content.is_empty() || message.content.len() > 24_000
    }) {
        return Err("Writing assessment messages are invalid.".to_string());
    }
    Ok(endpoint)
}

#[tauri::command]
pub async fn evaluate_writing(payload: EvaluateWritingPayload) -> Result<EvaluateWritingResponse, String> {
    let endpoint = validate_payload(&payload)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "Could not initialize the secure AI client.".to_string())?;
    let response = client
        .post(endpoint)
        .bearer_auth(&payload.api_key)
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": payload.model,
            "messages": payload.messages,
            "temperature": 0.15,
            "max_tokens": 2800,
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
    let value: Value = response.json().await.map_err(|_| "AI provider returned invalid JSON.".to_string())?;
    let content = safe_text(&value, &["choices", "0", "message", "content"])
        .or_else(|| value.get("choices").and_then(Value::as_array).and_then(|choices| choices.first()).and_then(|choice| safe_text(choice, &["message", "content"])))
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "AI provider returned no assessment content.".to_string())?;
    let model = value.get("model").and_then(Value::as_str).unwrap_or(&payload.model).to_string();
    let request_id = value.get("id").and_then(Value::as_str).unwrap_or("desktop-request").to_string();
    Ok(EvaluateWritingResponse {
        content,
        model,
        request_id,
        usage: TokenUsage {
            prompt_tokens: safe_number(&value, "prompt_tokens"),
            completion_tokens: safe_number(&value, "completion_tokens"),
            total_tokens: safe_number(&value, "total_tokens"),
        },
    })
}
