export interface SpeechVoice {
  waitingAnswer: string | null;
  defaultAnswer: string | null;
}

export let currentVoice: SpeechVoice = {
  waitingAnswer: null,
  defaultAnswer: null,
};
