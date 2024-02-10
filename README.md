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
- TypeScript (`npm install -g typescript`)
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

# AWS authorization information for using AWS S3 bucket (Using _VAL sufix to avoid colission with Vercel reserved env variable keywords)
AWS_ACCESS_KEY_VAL_VAL=your_aws_access_key
AWS_SECRET_ACCESS_KEY_VAL=your_aws_secret_access_key
AWS_REGION_VAL=your_aws_region
S3_BUCKET=your_s3_bucket_name

# Google Cloud API authentication information
GCLOUD_PROJECT_ID=your_gcloud_project_id
GCLOUD_CLIENT_EMAIL=your_gcloud_client_email
GCLOUD_PRIVATE_KEY=your_gcloud_private_key

# FakeYou TTS API for converting text-to-speech with DeepFake voices
FY_USERNAME=your_fakeyou_username
FY_PASSWORD=your_fakeyou_password
```
4. Build/compile TypeScript sources
```bash
npm run build
```

5. Start Discord bot application:
```bash
npm run start
```

## Usage

- Join a voice channel in your Discord server and ask the bot a question. It will transcribe your question, generate a response using the OpenAI API, and speak the answer using the FakeYou TTS API or Google TTS API based on possible choice.

- You can send message/question to the bot by sending a message to the channel with
  specific mention to the bot, for ex. `@botname Who are you?`

- You can also(only in voice channel) ask bot questions with voice. There are certain commands for voice channel to modify the bot's langugage,system message and
   voice:

   1. `@botname !lang langName` - changing the bot's voice language of understanding and responding, `langName` can have values of `english` or `serbian`
   2. `@botname !voice voiceName` - changing the sounding voice of the bot to some the available voices from provided list, you can use prefix of the full name if easier 
   !(only for english language otherwise default is Google TTS voice) 
   3. `@botname !system sysMsg` - changing OpenAI system message with which you align bot's answers to your preferences

List of possible `voiceName` values from 2. point: 
`Morgan Freeman`,`Snoop Dogg (V2)`,`Rick Sanchez`,`Optimus Prime (Peter Cullen)`,`Morty Smith`,`The Joker (Heath Ledger, Version 2.0)`,
`Eminem (Slim Shady era - 1997 - 2001)`,`James Earl Jones`,`Sean Connery`,`2Pac (Tupac Amaru Shakur) (ARPAbet supported)`

## Limitations

- Currently supports only English and Serbian languages
- There may be a slight delay when using English, with any other voice besides `Google`, due to slower responses from the FakeYou API. If you need fast responses 
  use command by sending a message `@botname !voice Google`

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
