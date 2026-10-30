import AVFoundation

/// Buyer voice playback — port of web/src/audio.ts Player. Plays the mp3 the
/// backend returns; `play` suspends until playback finishes.
final class Player: NSObject, AVAudioPlayerDelegate {
    private var current: AVAudioPlayer?
    private var continuation: CheckedContinuation<Void, Never>?

    func play(_ data: Data) async {
        stop()
        guard let player = try? AVAudioPlayer(data: data) else { return }
        current = player
        player.delegate = self
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            continuation = c
            if !player.play() { finish() }
        }
    }

    func stop() {
        current?.stop()
        current = nil
        finish()
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finish()
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        finish()
    }

    private func finish() {
        continuation?.resume()
        continuation = nil
    }
}
