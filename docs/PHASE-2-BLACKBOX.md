# Phase 2 black-box test

Phase 2 adds ChatGPT-style conversation sessions with a per-chat GPT/OCI Generative AI toggle. Sessions remain in memory: they are not written to Oracle or browser storage and disappear after a refresh.

## Setup

1. Start the app with `npm run dev`.
2. Sign in and open `/assistant`.
3. Confirm the Oracle connection banner still reports either `Oracle connected` or the existing development fallback state.

To test both AI providers, configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and the `OCI_GENAI_*` variables in `.env.local`. A provider without credentials should display a configuration error while the other provider remains usable.

## Conversation workflow

1. Click **+ New chat** and confirm an empty conversation appears with four starter prompts.
2. Choose **Help me schedule a dental appointment** and complete the guided ZIP, time, and payment choices.
3. Confirm the first message becomes the temporary conversation title.
4. Create a second chat and confirm its messages are independent from the first chat.
5. Switch between both chats and confirm each transcript is preserved during the current page session.
6. Rename a chat and confirm the new name appears in the sidebar.
7. From the inactive chat, click **Add context** and confirm a conversation context chip appears in the active chat.
8. Delete a chat, cancel the confirmation once, then confirm deletion and verify it is removed.

## AI provider toggle

1. Start a new chat and select **GPT**.
2. Ask a general question such as “What does deductible mean?” and confirm the reply is labeled `GPT` with its model when available.
3. Switch the same chat to **OCI GenAI**, ask a second general question, and confirm that reply is labeled `OCI GenAI`.
4. While a request is running, confirm the toggle and composer are disabled and a `Thinking…` response is visible.
5. Remove or invalidate one provider's credentials, retry it, and confirm the error appears inside that chat without deleting earlier messages.
6. Confirm scheduling prompts still use the guided local choices and can reach **Find options** even when neither AI provider is configured.

## Appointment context

If the demo already has an appointment, click **+ Appointment context** and confirm an appointment chip appears above the transcript. Clicking it again should not create a duplicate.

## Temporary-state boundary

1. Create or rename at least two chats.
2. Refresh the browser.
3. Confirm the Phase 2 session list resets. This is expected until a later database phase adds `CONVERSATIONS` and `MESSAGES`.
4. Confirm Oracle-backed profile and insurance data still reload independently of the temporary chats.

## Small-screen check

Resize the browser below 980 px wide. Confirm the conversation list stacks above the chat, remains scrollable, and the composer and starter prompts remain usable.
