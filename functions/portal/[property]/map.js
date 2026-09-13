export function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = "/maps/app/";
  return context.env.ASSETS.fetch(url);
}
