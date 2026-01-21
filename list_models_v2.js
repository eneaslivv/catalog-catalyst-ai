
const apiKey = process.env.GOOGLE_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("Models:");
            data.models.forEach(m => console.log(m.name));
            require('fs').writeFileSync('models_full.txt', data.models.map(m => m.name).join('\n'));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
