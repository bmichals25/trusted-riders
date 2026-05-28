let lastNonChatHref = "/";

export function getLastNonChatHref() {
  return lastNonChatHref;
}

export function rememberNonChatHref(href: string) {
  lastNonChatHref = href || "/";
}
