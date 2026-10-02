    // rolling chat history, sent to AIMM for conversational context
    const history = [];

    function getAimmEndpoint() {
      const endpoint = new URL("./.netlify/functions/aimm", window.location.href);
      return endpoint.toString();
    }

    async function askAimm(question) {
      const url = getAimmEndpoint();
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history })
      });
      if (!resp.ok) throw new Error("AIMM request failed: " + resp.status);
      const data = await resp.json();
      if (!data.reply) throw new Error("AIMM returned no reply");
      return data.reply;
    }
