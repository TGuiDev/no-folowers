// Instagram export JSON has shifted shape across versions:
// - plain array of { string_list_data: [{ value, href, timestamp }] }
// - { relationships_followers: [...] } / { relationships_following: [...] }
// Newer exports drop `value` from string_list_data entirely; the username
// then only exists in the entry-level `title`, or has to be parsed out of
// the href (which may be .../username or .../_u/username).

export function usernameFromHref(href) {
  if (!href) return null;
  const path = href.split('?')[0].replace(/\/+$/, '');
  const last = path.split('/').pop();
  return last === '_u' ? null : last;
}

export function extractUsernames(json) {
  let list = json;
  if (!Array.isArray(list)) {
    const key = Object.keys(json).find((k) => Array.isArray(json[k]));
    list = key ? json[key] : [];
  }
  const out = [];
  for (const entry of list) {
    const items = entry.string_list_data || [];
    for (const item of items) {
      const username = item.value || entry.title || usernameFromHref(item.href);
      if (username) out.push({ username, href: item.href || `https://www.instagram.com/${username}/` });
    }
  }
  return out;
}
