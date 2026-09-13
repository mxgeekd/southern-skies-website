export function onRequest(context) {
  const url = new URL("/maps/app/", context.request.url);
  return Response.redirect(url, 301);
}
