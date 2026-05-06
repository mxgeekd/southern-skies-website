export async function onRequestGet() {
  return new Response("Quote function is live", { status: 200 });
}
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    const name = formData.get("name") || "";
    const phone = formData.get("phone") || "";
    const location = formData.get("location") || "";
    const service = formData.get("service") || "";
    const details = formData.get("details") || "";

    const message = `
New quote request from Southern Skies Agritech website

Name: ${name}
Phone: ${phone}
Location / Property: ${location}
Service required: ${service}

Job details:
${details}
`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Southern Skies Agritech <website@southernskiesagritech.com.au>",
        // to: ["mxgeekd@gmail.com"],
        //from: "Southern Skies Agritech <onboarding@resend.dev>",
        to: ["info@southernskiesagritech.com.au"],
        subject: "New quote request - Southern Skies Agritech",
        text: message
      })
    });

    if (!response.ok) {
      return new Response("Email failed to send", { status: 500 });
    }

    return Response.redirect(new URL("/mockup-1/thanks.html", request.url), 303);

  } catch (err) {
    return new Response("Form submission failed", { status: 500 });
  }
}
