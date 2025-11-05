export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // The API returns raw PCM data. We need to convert it to a format the Web Audio API understands.
  // The data is 16-bit PCM, so each sample is 2 bytes.
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize the 16-bit integer sample to a float between -1.0 and 1.0
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Encodes an AudioBuffer into a WAV file format Blob.
 * @param buffer The AudioBuffer to encode.
 * @returns A Blob representing the WAV file.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Helper function to write strings
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, length - 8, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;

  // fmt chunk
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, 1, true); pos += 2;
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, buffer.sampleRate, true); pos += 4;
  view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
  view.setUint16(pos, numOfChan * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;

  // data chunk
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, length - pos - 4, true); pos += 4;

  // Write the PCM data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: 'audio/wav' });
}