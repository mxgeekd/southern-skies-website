export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    const turnstileToken = formData.get("cf-turnstile-response");
    const ip = request.headers.get("CF-Connecting-IP");

    if (!turnstileToken) {
      return new Response("Verification missing. Please try again.", { status: 403 });
    }

    const turnstileFormData = new FormData();
    turnstileFormData.append("secret", env.TURNSTILE_SECRET_KEY);
    turnstileFormData.append("response", turnstileToken);

    if (ip) {
      turnstileFormData.append("remoteip", ip);
    }

    const turnstileResult = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: turnstileFormData
      }
    );

    const turnstileOutcome = await turnstileResult.json();

    if (!turnstileOutcome.success) {
      return new Response("Verification failed. Please try again.", { status: 403 });
    }

    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const service = String(formData.get("service") || "").trim();
    const details = String(formData.get("details") || "").trim();

    if (!name || !phone || !location || !details) {
      return new Response("Missing required fields.", { status: 400 });
    }

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
        to: ["info@southernskiesagritech.com.au"],
        reply_to: "info@southernskiesagritech.com.au",
        subject: "New quote request - Southern Skies Agritech",
        text: message
      })
    });

    if (!response.ok) {
      return new Response("Email failed to send", { status: 500 });
    }

    return Response.redirect(new URL("/thanks.html", request.url), 303);

  } catch (err) {
    return new Response("Form submission failed", { status: 500 });
  }
}