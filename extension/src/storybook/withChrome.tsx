import type { ReactElement } from "react";

import type { Msg, MsgResult } from "../lib/messages";

type Reply = (message: Msg) => MsgResult | Promise<MsgResult>;

export function withChrome(reply: Reply) {
  return (Story: () => ReactElement) => {
    Object.assign(globalThis, {
      chrome: {
        runtime: {
          sendMessage: async (message: Msg) => reply(message),
        },
      },
    });
    return <Story />;
  };
}
