# Phase 2 black-box test

Phase 2 adds frontend-only ChatGPT-style conversation sessions. The sessions are intentionally kept in memory: they are not written to Oracle or browser storage and disappear after a refresh.

## Setup

1. Start the app with `npm run dev`.
2. Sign in and open `/assistant`.
3. Confirm the Oracle connection banner still reports either `Oracle connected` or the existing development fallback state.

## Conversation workflow

1. Click **+ New chat** and confirm an empty conversation appears with four starter prompts.
2. Choose **Help me schedule a dental appointment** and complete the guided ZIP, time, and payment choices.
3. Confirm the first message becomes the temporary conversation title.
4. Create a second chat and confirm its messages are independent from the first chat.
5. Switch between both chats and confirm each transcript is preserved during the current page session.
6. Rename a chat and confirm the new name appears in the sidebar.
7. From the inactive chat, click **Add context** and confirm a conversation context chip appears in the active chat.
8. Delete a chat, cancel the confirmation once, then confirm deletion and verify it is removed.

## Appointment context

If the demo already has an appointment, click **+ Appointment context** and confirm an appointment chip appears above the transcript. Clicking it again should not create a duplicate.

## Temporary-state boundary

1. Create or rename at least two chats.
2. Refresh the browser.
3. Confirm the Phase 2 session list resets. This is expected until a later database phase adds `CONVERSATIONS` and `MESSAGES`.
4. Confirm Oracle-backed profile and insurance data still reload independently of the temporary chats.

## Small-screen check

Resize the browser below 980 px wide. Confirm the conversation list stacks above the chat, remains scrollable, and the composer and starter prompts remain usable.
