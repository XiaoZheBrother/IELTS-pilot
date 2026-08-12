mod ai_assistant;
mod ai_credentials;
mod ai_writing;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ai_assistant::AssistantStreamState::default())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            ai_writing::evaluate_writing,
            ai_assistant::chat_assistant,
            ai_assistant::chat_assistant_stream,
            ai_assistant::cancel_assistant_stream,
            ai_assistant::test_ai_connection,
            ai_credentials::get_ai_settings_status,
            ai_credentials::save_ai_credential,
            ai_credentials::clear_ai_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running IELTS Pilot");
}

#[cfg(test)]
mod tests {
    use crate::ai_assistant::{parse_stream_data, validate_assistant_payload, AiMessage, AssistantChatPayload};
    use crate::ai_credentials::validate_api_key;

    fn payload(endpoint: &str) -> AssistantChatPayload {
        AssistantChatPayload {
            endpoint: endpoint.to_string(),
            model: "fixture-model".to_string(),
            request_id: None,
            messages: vec![
                AiMessage { role: "system".to_string(), content: "Use supplied facts only.".to_string() },
                AiMessage { role: "user".to_string(), content: "Analyze the snapshot.".to_string() },
            ],
        }
    }

    #[test]
    fn assistant_stream_parser_extracts_delta_metadata_and_usage() {
        let event = parse_stream_data(r#"data: {"id":"stream-1","model":"fixture","choices":[{"delta":{"content":"你好"}}],"usage":{"prompt_tokens":8,"completion_tokens":4,"total_tokens":12}}"#)
            .unwrap().unwrap();
        assert_eq!(event.delta.as_deref(), Some("你好"));
        assert_eq!(event.request_id.as_deref(), Some("stream-1"));
        assert_eq!(event.model.as_deref(), Some("fixture"));
        assert_eq!(event.total_tokens, Some(12));
        assert!(parse_stream_data("data: [DONE]").unwrap().is_none());
    }

    #[test]
    fn assistant_payload_requires_https_and_two_bounded_messages() {
        assert!(validate_assistant_payload(&payload("https://api.example.com/chat/completions")).is_ok());
        assert!(validate_assistant_payload(&payload("https://secret@api.example.com/chat/completions")).is_err());
        assert!(validate_assistant_payload(&payload("http://api.example.com/chat/completions")).is_err());
        let mut invalid = payload("https://api.example.com/chat/completions");
        invalid.messages.pop();
        assert!(validate_assistant_payload(&invalid).is_err());
    }

    #[test]
    fn credential_validation_rejects_empty_or_oversized_secrets() {
        assert!(validate_api_key("valid-secret").is_ok());
        assert!(validate_api_key("  ").is_err());
        assert!(validate_api_key(&"x".repeat(513)).is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn credential_is_protected_with_a_windows_user_roundtrip() {
        let secret = b"test-secret-that-must-not-remain-plain";
        let (encrypted, decrypted) = crate::ai_credentials::protected_roundtrip_for_test(secret).unwrap();
        assert_ne!(encrypted, secret);
        assert_eq!(decrypted, secret);
    }
}
