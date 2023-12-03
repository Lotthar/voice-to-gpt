declare namespace NodeJS {
  interface ProcessEnv {
    DISCORD_API_KEY: string;
    DISCORD_APP_ID:string,
    DISCORD_GUILD_ID: string,
    OPEN_API_KEY: string;
    AWS_ACCESS_KEY: string;
    AWS_SECRET_ACCESS_KEY: string;
    AWS_REGION: string;
    S3_BUCKET: string;
    GCLOUD_PROJECT_ID: string;
    GCLOUD_CLIENT_EMAIL: string;
    GCLOUD_PRIVATE_KEY: string;
    FY_USERNAME: string;
    FY_PASSWORD: string;
    REPLICATE_API_TOKEN: string
  }
}
