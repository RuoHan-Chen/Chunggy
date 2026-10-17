import { postChat } from "@/lib/chat-post";

export function POST(request: Request) {
  return postChat(request, "oci");
}
