# Voice-to-GPT Discord Bot

A Discord bot that listens to questions from voice channels and responds using the OpenAI API. The bot converts the text response to speech using the FakeYou TTS API.

## Features

- Transcribe voice from Discord voice channels using Google Cloud Speech-to-Text
- Generate responses using the OpenAI GPT API
- Convert responses to speech using the FakeYou TTS API
- Support for English and Serbian languages
- Store and manage audio files on AWS S3

## Prerequisites

- Node.js v18.x
- An account with Discord, OpenAI, Google Cloud, AWS, and FakeYou
- API keys and credentials for the services mentioned above

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/voice-to-gpt.git
cd voice-to-gpt
```
2. Install dependencies:
```bash
npm install
```
3. Create a .env file in the project root directory and fill in the required keys from the provided template below. Replace the placeholder values with your API keys and credentials:
```properties
# Discord.js client API key for connecting to your specifically defined application for Discord
DISCORD_API_KEY=your_discord_api_key

# OpenAI API key for authenticating API calls
OPEN_API_KEY=your_openai_api_key

# AWS authorization information for using AWS S3 bucket
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
S3_BUCKET=your_s3_bucket_name

# Google Cloud API authentication information
GCLOUD_PROJECT_ID=your_gcloud_project_id
GCLOUD_CLIENT_EMAIL=your_gcloud_client_email
GCLOUD_PRIVATE_KEY=your_gcloud_private_key

# FakeYou TTS API for converting text-to-speech with DeepFake voices
FY_USERNAME=your_fakeyou_username
FY_PASSWORD=your_fakeyou_password
```
4. Start the bot:
```bash
npm run start
```

## Usage

Join a voice channel in your Discord server and ask the bot a question. It will transcribe your question, generate a response using the OpenAI API, and speak the answer using the FakeYou TTS API.

## Limitations

- Currently supports only English and Serbian languages
- There may be a slight delay when using English due to slower responses from the FakeYou API

## Deployment

This project is deployed as a worker service on Heroku using a Dockerfile.

## Contributing

We welcome contributions! Feel free to submit issues for bug reports, feature requests, or open pull requests with code improvements.

## License

This project is licensed under the ISC License.

## Credits

- Author: branko.rovcanin

## Contact

For support or further information, reach out to branko.rovcanin@example.com or follow [github_username](https://github.com/yourusername) on GitHub.
