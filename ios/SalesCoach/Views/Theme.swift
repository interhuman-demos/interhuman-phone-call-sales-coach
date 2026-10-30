import SwiftUI

/// Adaptive design tokens matching the Claude Design handoff (light + dark
/// variants). Colors resolve automatically under the active system appearance
/// via a `UIColor` dynamic provider, so call sites stay
/// `Color.accent`/`.good`/`.bad` with no `colorScheme` plumbing.
extension Color {
    /// Gold — the primary accent.
    static let accent = Color(light: 0xB8791A, dark: 0xF2B53C)
    /// Teal — positive signals, strong moments.
    static let good = Color(light: 0x0C8C7D, dark: 0x35D0BF)
    /// Coral — warnings, watch-outs, End.
    static let bad = Color(light: 0xC94A33, dark: 0xF56A52)
    /// Amber — mid-trajectory / medium difficulty. Reuses the accent gold.
    static let warn = Color(light: 0xB8791A, dark: 0xF2B53C)

    /// Warm-ivory tab-root background from the mock (light) / near-black (dark).
    static let bg = Color(light: 0xF1EFE9, dark: 0x0D0D0F)
    /// Grouped-list card container.
    static let groupedBg = Color(uiColor: .secondarySystemGroupedBackground)
    /// A raised panel/surface.
    static let panel = Color(uiColor: .secondarySystemGroupedBackground)
    /// Hairline separators / strokes.
    static let line = Color(light: 0xE0D9CB, dark: 0x2C2C34)

    static let textPrimary = Color(uiColor: .label)
    /// Secondary text (`rgba(60,60,67,.6)` light / `rgba(235,235,245,.6)` dark).
    static let dim = Color(uiColor: .secondaryLabel)
    /// Tertiary text.
    static let ter = Color(uiColor: .tertiaryLabel)

    /// Solid RGB from a hex literal.
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255)
    }

    /// A dynamic color that resolves to `light`/`dark` per the active trait.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xff) / 255,
                green: CGFloat((hex >> 8) & 0xff) / 255,
                blue: CGFloat(hex & 0xff) / 255,
                alpha: 1)
        })
    }
}

func healthColor(_ health: Int) -> Color {
    health >= 60 ? .good : health >= 45 ? .warn : .bad
}

func difficultyColor(_ difficulty: String) -> Color {
    switch difficulty {
    case "easy": return .good
    case "medium": return .warn
    default: return .bad
    }
}

/// Monogram initials for a buyer's avatar — mirrors web/src/avatar.ts.
func initials(_ name: String) -> String {
    name.replacingOccurrences(of: "Dr. ", with: "")
        .split(separator: " ")
        .prefix(2)
        .compactMap { $0.first }
        .map(String.init)
        .joined()
        .uppercased()
}

// MARK: - avatar photo pool

/// A small pool of generic stand-in headshots (`Avatars/avatar01`…`avatar15`
/// in the asset catalog) that every persona — built-in or user-created —
/// draws from. Assignment is a stable hash of the persona id, so the same
/// buyer always gets the same face across launches and screens.
enum AvatarPool {
    static let count = 15

    /// The asset name to use for a given persona id, e.g. "avatar07".
    static func imageName(for personaId: String) -> String {
        var hasher = Hasher()
        hasher.combine(personaId)
        let bucket = Int(UInt(bitPattern: hasher.finalize()) % UInt(count))
        return String(format: "avatar%02d", bucket + 1)
    }
}

/// A buyer's avatar as a photo circle, falling back to the tinted monogram
/// if the asset is somehow missing (e.g. running against an older catalog).
struct PersonaAvatar: View {
    let persona: Persona
    var size: CGFloat = 44

    var body: some View {
        Group {
            if let uiImage = UIImage(named: AvatarPool.imageName(for: persona.id)) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Monogram(name: persona.name, size: size)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.line, lineWidth: 0.75))
    }
}
