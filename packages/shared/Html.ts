export default class Html {
  static loopbackAudioElement() {
    const audio = document.getElementById('voice-chat-audio')
    if (!audio) {
      console.error('There is no #voice-chat-audio element to use with VoiceChat. Returning a `new Audio()`')
      return new Audio()
    }
    return audio as HTMLAudioElement | undefined
  }
}
