
const apiKey = process.env.GOOGLE_API_KEY;
const LIST_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function listModels() {
    console.log('Listing models...');
    try {
        const response = await fetch(`${LIST_MODELS_URL}?key=${apiKey}`);
        const text = await response.text();
        console.log('Status:', response.status);
        const data = JSON.parse(text);
        if (data.models) {
            console.log('Available models:');
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log('No models found or error structure:', text.substring(0, 200));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
