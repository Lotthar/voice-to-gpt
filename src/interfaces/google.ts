export interface TTSOption {
  lang?: string;
  slow?: boolean;
  host?: string;
}

export interface LongTTSOption extends TTSOption {
  splitPunct?: string;
}
