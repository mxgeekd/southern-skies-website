export async function onRequestGet(context) {
  const url = new URL("/maps/t50/manifest.json", context.request.url);
  const response = await context.env.ASSETS.fetch(url);
  if (!response.ok) return response;
  const manifest = await response.json();
  manifest.plans = (manifest.plans || []).filter(plan => plan.propertyId === context.params.property);
  return Response.json(manifest, {headers: {"Cache-Control": "no-store"}});
}
