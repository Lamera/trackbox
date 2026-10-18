//! The Pioneer DJ DDJ-FLX4.
//!
//! **[MIXXX]** Every number here comes from the Mixxx mapping
//! (`Pioneer-DDJ-FLX4.midi.xml` and its script, GPL-2.0-or-later) as facts
//! about the hardware; no code is taken from it. Each is to be confirmed on a
//! real unit — see `plan.md` §3. Unknowns are marked **[VERIFY]**.
//!
//! Status bytes: deck 1 on MIDI channel 1 (`0x90`/`0xB0`), deck 2 on channel 2,
//! the mixer's global controls on channel 7 (`0x96`/`0xB6`), and the pads on
//! channels 8 to 11 — deck 1, deck 1 with SHIFT, deck 2, deck 2 with SHIFT.

use crate::{Band, Button, Deck, DeckLeds, Intent, JogMode, PadMode, Short};

/// Whether a MIDI port is this controller's. **[VERIFY]** the exact port
/// name on macOS, Windows and Linux; every one seen so far contains this.
#[must_use]
pub fn matches(port_name: &str) -> bool {
    port_name.contains("DDJ-FLX4")
}

/// Whether an audio output is this controller's built-in interface, which
/// carries the master on outputs 1/2 and the headphones on 3/4.
#[must_use]
pub fn is_audio_device(name: &str) -> bool {
    name.contains("DDJ-FLX4")
}

/// Sent on connect and every 200 ms. [OBS] It does not make the hardware
/// report its knob and fader positions; nothing found so far does.
pub const KEEPALIVE: [u8; 12] = [0xF0, 0x00, 0x40, 0x05, 0x00, 0x00, 0x04, 0x05, 0x00, 0x50, 0x02, 0xF7];

const GLOBAL: u8 = 6;
const NO_VALUE: u16 = u16::MAX;
/// The HOT CUE pad mode button, lit when the controller starts.
const HOT_CUE_MODE: u8 = 0x1B;
/// The pad mode buttons, without and with SHIFT.
const PAD_MODES: [u8; 8] = [0x1B, 0x69, 0x1E, 0x6B, 0x20, 0x6D, 0x22, 0x6F];

/// The decoder: the MSB half of each 14-bit control until its LSB arrives,
/// the last value each one reported, the running status, and the pad mode
/// button last pressed on each deck.
pub struct Flx4 {
    msb: [[u8; 32]; 16],
    last: [[u16; 32]; 16],
    running: u8,
    pad_modes: [u8; 2],
}

impl Default for Flx4 {
    fn default() -> Self {
        Self { msb: [[0; 32]; 16], last: [[NO_VALUE; 32]; 16], running: 0, pad_modes: [HOT_CUE_MODE; 2] }
    }
}

fn deck_of(channel: u8) -> Option<Deck> {
    match channel {
        0 => Some(Deck::A),
        1 => Some(Deck::B),
        _ => None,
    }
}

/// A relative encoder: 64 is still, below is anticlockwise.
fn ticks(value: u8) -> i32 {
    i32::from(value) - 64
}

/// BROWSE: two's complement in seven bits, 1 is one step clockwise.
fn steps(value: u8) -> i32 {
    if value >= 64 { i32::from(value) - 128 } else { i32::from(value) }
}

impl Flx4 {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// The pad mode button last pressed on `deck`, for its LED.
    #[must_use]
    pub fn pad_mode(&self, deck: Deck) -> u8 {
        self.pad_modes.get(deck.index()).copied().unwrap_or(HOT_CUE_MODE)
    }

    /// One MIDI message in, at most one intent out. `SysEx` and anything this
    /// profile does not map come back as `None`.
    pub fn decode(&mut self, bytes: &[u8]) -> Option<Intent> {
        let (&first, rest) = bytes.split_first()?;
        let (status, data) = if first >= 0x80 {
            if first < 0xF0 {
                self.running = first;
            }
            (first, rest)
        } else {
            (self.running, bytes)
        };
        let channel = status & 0x0F;
        let a = *data.first()?;
        let b = data.get(1).copied().unwrap_or(0);
        match status & 0xF0 {
            0x90 => self.note(channel, a, b > 0),
            0x80 => self.note(channel, a, false),
            0xB0 => self.control(channel, a, b),
            _ => None,
        }
    }

    fn note(&mut self, channel: u8, note: u8, pressed: bool) -> Option<Intent> {
        if let Some(deck) = deck_of(channel) {
            if PAD_MODES.contains(&note) {
                if pressed {
                    if let Some(mode) = self.pad_modes.get_mut(deck.index()) {
                        *mode = note;
                    }
                }
                return None;
            }
            let button = match note {
                0x0B => Button::Play,
                0x0E => Button::ShiftPlay,
                0x0C => Button::Cue,
                0x48 => Button::TrackStart,
                0x58 => Button::Sync,
                0x5C => Button::SyncHold,
                0x60 => Button::TempoRange,
                0x10 => Button::LoopIn,
                0x11 => Button::LoopOut,
                0x4C => Button::ShiftLoopIn,
                0x4E => Button::ShiftLoopOut,
                0x4D => Button::Reloop,
                0x50 => Button::ShiftReloop,
                0x51 => Button::CallPrevious,
                0x53 => Button::CallNext,
                0x3E => Button::ShiftCallPrevious,
                0x3D => Button::ShiftCallNext,
                0x68 => Button::Quantize,
                0x54 => return pressed.then_some(Intent::ChannelCue { deck }),
                0x36 | 0x67 => return Some(Intent::JogTouch { deck, touched: pressed }),
                _ => return None,
            };
            return Some(Intent::Button { deck, button, pressed });
        }
        match channel {
            // BEAT FX: channel 5 with the lever on CH1 or CH1+2, 6 on CH2.
            4 | 5 => match note {
                0x63 if pressed => Some(Intent::FxSelect { previous: false }),
                0x64 if pressed => Some(Intent::FxSelect { previous: true }),
                0x4A if pressed => Some(Intent::FxBeat { longer: false }),
                0x4B if pressed => Some(Intent::FxBeat { longer: true }),
                0x47 if pressed => Some(Intent::FxToggle { off: false }),
                0x43 if pressed => Some(Intent::FxToggle { off: true }),
                0x10 if channel == 4 => Some(Intent::FxChannel { deck: Deck::A, selected: pressed }),
                0x11 if channel == 5 => Some(Intent::FxChannel { deck: Deck::B, selected: pressed }),
                _ => None,
            },
            GLOBAL => match note {
                0x41 if pressed => Some(Intent::BrowsePress { shift: false }),
                0x42 if pressed => Some(Intent::BrowsePress { shift: true }),
                0x46 if pressed => Some(Intent::Load { deck: Deck::A }),
                0x47 if pressed => Some(Intent::Load { deck: Deck::B }),
                // [OBS] MASTER CUE is a note to the software, not a switch in the hardware.
                0x63 if pressed => Some(Intent::MasterCue),
                _ => None,
            },
            7..=10 => {
                let deck = if channel < 9 { Deck::A } else { Deck::B };
                let shift = channel == 8 || channel == 10;
                let pad = note & 0x0F;
                if pad > 7 {
                    return None;
                }
                // **[VERIFY]** PAD FX1/FX2 at 0x10/0x50: not in the Mixxx mapping.
                let mode = match note >> 4 {
                    0 => PadMode::HotCue,
                    1 => PadMode::PadFx1,
                    2 => PadMode::BeatJump,
                    3 => PadMode::Sampler,
                    4 => PadMode::Keyboard,
                    5 => PadMode::PadFx2,
                    6 => PadMode::BeatLoop,
                    _ => PadMode::KeyShift,
                };
                Some(Intent::Pad { deck, mode, pad, shift, pressed })
            }
            _ => None,
        }
    }

    fn control(&mut self, channel: u8, cc: u8, value: u8) -> Option<Intent> {
        if let Some(deck) = deck_of(channel) {
            // Relative first: these sit in the range 14-bit LSBs use.
            let mode = match cc {
                0x22 => Some(JogMode::Scratch),
                0x21 | 0x23 => Some(JogMode::Bend),
                0x29 => Some(JogMode::Search),
                _ => None,
            };
            if let Some(mode) = mode {
                return Some(Intent::Jog { deck, mode, ticks: ticks(value) });
            }
        }
        if channel == GLOBAL {
            match cc {
                0x40 => return Some(Intent::Browse { steps: steps(value) }),
                // SHIFT turns it a page at a time.
                0x64 => return Some(Intent::Browse { steps: steps(value) * 8 }),
                _ => {}
            }
        }
        let row = usize::from(channel);
        match cc {
            0x00..=0x1F => {
                *self.msb.get_mut(row)?.get_mut(usize::from(cc))? = value;
                None
            }
            0x20..=0x3F => {
                let msb_cc = cc - 0x20;
                let msb = *self.msb.get(row)?.get(usize::from(msb_cc))?;
                let full = (u16::from(msb) << 7) | u16::from(value);
                let last = self.last.get_mut(row)?.get_mut(usize::from(msb_cc))?;
                // The keepalive makes the hardware report every control again;
                // a value that has not moved is not news.
                if *last == full {
                    return None;
                }
                *last = full;
                Self::position(channel, msb_cc, f32::from(full) / 16_383.0)
            }
            _ => None,
        }
    }

    fn position(channel: u8, cc: u8, at: f32) -> Option<Intent> {
        if let Some(deck) = deck_of(channel) {
            return match cc {
                // [OBS] Pushed to its + end the fader reads 0x3FFF.
                0x00 => Some(Intent::Tempo { deck, value: at * 2.0 - 1.0 }),
                0x04 => Some(Intent::Trim { deck, value: trim_gain(at) }),
                0x07 => Some(Intent::Eq { deck, band: Band::High, value: at }),
                0x0B => Some(Intent::Eq { deck, band: Band::Mid, value: at }),
                0x0F => Some(Intent::Eq { deck, band: Band::Low, value: at }),
                0x13 => Some(Intent::Volume { deck, value: at }),
                _ => None,
            };
        }
        // [OBS] LEVEL/DEPTH is 14-bit, on channel 5 or 6 by the lever's position.
        if matches!(channel, 4 | 5) && cc == 0x02 {
            return Some(Intent::FxDepth { value: at });
        }
        if channel != GLOBAL {
            return None;
        }
        match cc {
            0x1F => Some(Intent::Crossfader { value: at }),
            0x0C => Some(Intent::HeadphoneMix { value: at }),
            0x17 => Some(Intent::Filter { deck: Deck::A, value: at }),
            0x18 => Some(Intent::Filter { deck: Deck::B, value: at }),
            _ => None,
        }
    }
}

fn on(lit: bool) -> u8 {
    if lit { 0x7F } else { 0x00 }
}

/// The TRIM knob as a gain, even in decibels as a mixer's is: the centre is
/// unity, the right end +6 dB (the engine's most), the left −26 dB and then
/// silence in the last notch.
fn trim_gain(at: f32) -> f32 {
    if at >= 0.5 {
        return 10_f32.powf(6.0 * (at - 0.5) * 2.0 / 20.0);
    }
    if at < 0.02 {
        return 0.0;
    }
    10_f32.powf(-26.0 * (1.0 - at * 2.0) / 20.0)
}

/// Every LED of one deck, as the messages that set it. The host keeps what it
/// last sent and only sends what changed. **[MIXXX]** Each button is lit on
/// its SHIFT layer too, so holding SHIFT does not put it out.
#[must_use]
pub fn leds(deck: Deck, state: &DeckLeds) -> Vec<Short> {
    let channel = u8::from(deck == Deck::B);
    let note = 0x90 | channel;
    // The loop buttons are lit while there is no loop and blink in one; while
    // the jog moves a loop point, only that point's button blinks.
    let loop_lit = !state.looping || state.blink;
    let (in_lit, out_lit) = match state.loop_adjust {
        1 => (state.blink, false),
        2 => (false, state.blink),
        _ => (loop_lit, loop_lit),
    };
    let mut out = vec![
        [note, 0x0B, on(state.play)],
        [note, 0x47, on(state.play)],
        [note, 0x0C, on(state.cue)],
        [note, 0x48, on(state.cue)],
        [note, 0x58, on(state.sync)],
        [note, 0x54, on(state.channel_cue)],
        [note, 0x10, on(in_lit)],
        [note, 0x4C, on(in_lit)],
        [note, 0x11, on(out_lit)],
        [note, 0x4E, on(out_lit)],
        [note, 0x4D, on(state.looping)],
        [note, 0x50, on(state.looping)],
        [0xB0 | channel, 0x02, state.level.min(127)],
    ];
    if state.pad_mode != 0 {
        out.push([note, state.pad_mode, 0x7F]);
    }
    // Both pad layers, so letting go of SHIFT does not leave them dark.
    let pads = if deck == Deck::A { 0x97 } else { 0x99 };
    for layer in [pads, pads + 1] {
        for (pad, set) in (0_u8..).zip(state.hot_cues.iter()) {
            out.push([layer, pad, on(*set)]);
        }
    }
    out
}

/// The BEAT FX ON/OFF LED, on both lever positions and both layers.
#[must_use]
pub fn fx_leds(lit: bool) -> [Short; 4] {
    [[0x94, 0x47, on(lit)], [0x94, 0x43, on(lit)], [0x95, 0x47, on(lit)], [0x95, 0x43, on(lit)]]
}

/// The MASTER CUE LED.
#[must_use]
pub fn master_cue_led(lit: bool) -> Short {
    [0x96, 0x63, on(lit)]
}

/// Every LED this profile lights, put out: for a disconnect and for quitting,
/// so the hardware is not left showing a deck that is gone.
#[must_use]
pub fn all_off() -> Vec<Short> {
    let mut out = Vec::new();
    for deck in Deck::ALL {
        let note = 0x90 | u8::from(deck == Deck::B);
        // Pads are added below in every mode, not only the hot cues `leds` covers.
        out.extend(
            leds(deck, &DeckLeds::default())
                .into_iter()
                .filter(|[status, ..]| !(0x97..=0x9A).contains(status))
                .map(|[status, data, _]| [status, data, 0]),
        );
        out.extend(PAD_MODES.map(|mode| [note, mode, 0]));
    }
    for layer in 0x97..=0x9A {
        for mode in 0_u8..8 {
            out.extend((0_u8..8).map(|pad| [layer, (mode << 4) | pad, 0]));
        }
    }
    out.extend(fx_leds(false));
    out.push(master_cue_led(false));
    out
}

/// **[MIXXX]** The jog ring's "track loaded" animation on `deck`.
#[must_use]
pub fn track_loaded(deck: Deck) -> Short {
    [0x9F, u8::from(deck == Deck::B), 0x7F]
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::float_cmp, clippy::panic)]
mod tests {
    use super::*;

    fn fader(flx: &mut Flx4, status: u8, msb_cc: u8, value: u16) -> Option<Intent> {
        let msb = u8::try_from(value >> 7).unwrap();
        let lsb = u8::try_from(value & 0x7F).unwrap();
        assert_eq!(flx.decode(&[status, msb_cc, msb]), None, "the MSB alone is not a position");
        flx.decode(&[status, msb_cc + 0x20, lsb])
    }

    #[test]
    fn deck_buttons_press_and_release() {
        let mut flx = Flx4::new();
        assert_eq!(
            flx.decode(&[0x90, 0x0B, 0x7F]),
            Some(Intent::Button { deck: Deck::A, button: Button::Play, pressed: true })
        );
        assert_eq!(
            flx.decode(&[0x91, 0x0C, 0x00]),
            Some(Intent::Button { deck: Deck::B, button: Button::Cue, pressed: false })
        );
        // A note off is a release too.
        assert_eq!(
            flx.decode(&[0x81, 0x58, 0x40]),
            Some(Intent::Button { deck: Deck::B, button: Button::Sync, pressed: false })
        );
        assert_eq!(flx.decode(&[0x90, 0x3F, 0x7F]), None, "SHIFT on its own does nothing");
    }

    #[test]
    fn the_channel_cue_toggles_on_the_press_only() {
        let mut flx = Flx4::new();
        assert_eq!(flx.decode(&[0x91, 0x54, 0x7F]), Some(Intent::ChannelCue { deck: Deck::B }));
        assert_eq!(flx.decode(&[0x91, 0x54, 0x00]), None);
    }

    #[test]
    fn fourteen_bit_controls_land_on_the_lsb() {
        let mut flx = Flx4::new();
        assert_eq!(
            fader(&mut flx, 0xB0, 0x13, 16_383),
            Some(Intent::Volume { deck: Deck::A, value: 1.0 })
        );
        assert_eq!(fader(&mut flx, 0xB6, 0x1F, 0), Some(Intent::Crossfader { value: 0.0 }));
        let Some(Intent::Trim { value, .. }) = fader(&mut flx, 0xB1, 0x04, 0x2000) else { panic!() };
        assert!((value - 1.0).abs() < 1e-3, "the trim's centre is unity: {value}");
        let Some(Intent::Tempo { value, .. }) = fader(&mut flx, 0xB0, 0x00, 0x2000) else { panic!() };
        assert!(value.abs() < 1e-3, "the tempo fader's centre is no change: {value}");
        assert_eq!(fader(&mut flx, 0xB0, 0x00, 0x3FFF), Some(Intent::Tempo { deck: Deck::A, value: 1.0 }));
        let Some(Intent::Trim { value, .. }) = fader(&mut flx, 0xB0, 0x04, 0x3FFF) else { panic!() };
        assert!((value - 1.995).abs() < 0.01, "the trim's right end is +6 dB: {value}");
        let Some(Intent::Trim { value, .. }) = fader(&mut flx, 0xB0, 0x04, 0x1000) else { panic!() };
        assert!((20.0 * value.log10() + 13.0).abs() < 0.2, "a quarter turn is −13 dB: {value}");
        assert_eq!(fader(&mut flx, 0xB0, 0x04, 0), Some(Intent::Trim { deck: Deck::A, value: 0.0 }));
        assert_eq!(flx.decode(&[0x96, 0x63, 0x7F]), Some(Intent::MasterCue));
        assert_eq!(flx.decode(&[0x96, 0x63, 0x00]), None);
        assert_eq!(
            fader(&mut flx, 0xB6, 0x18, 16_383),
            Some(Intent::Filter { deck: Deck::B, value: 1.0 })
        );
        assert_eq!(fader(&mut flx, 0xB6, 0x0C, 0), Some(Intent::HeadphoneMix { value: 0.0 }));
        let Some(Intent::Eq { band, .. }) = fader(&mut flx, 0xB0, 0x0B, 100) else { panic!() };
        assert_eq!(band, Band::Mid);
    }

    #[test]
    fn a_position_reported_again_is_not_news() {
        let mut flx = Flx4::new();
        assert!(fader(&mut flx, 0xB0, 0x13, 9_000).is_some());
        assert_eq!(fader(&mut flx, 0xB0, 0x13, 9_000), None);
        assert!(fader(&mut flx, 0xB0, 0x13, 9_001).is_some());
    }

    #[test]
    fn the_jog_wheels_are_relative_and_split_by_where_they_are_turned() {
        let mut flx = Flx4::new();
        assert_eq!(
            flx.decode(&[0xB0, 0x22, 0x43]),
            Some(Intent::Jog { deck: Deck::A, mode: JogMode::Scratch, ticks: 3 })
        );
        assert_eq!(
            flx.decode(&[0xB1, 0x21, 0x3E]),
            Some(Intent::Jog { deck: Deck::B, mode: JogMode::Bend, ticks: -2 })
        );
        assert_eq!(
            flx.decode(&[0xB0, 0x29, 0x41]),
            Some(Intent::Jog { deck: Deck::A, mode: JogMode::Search, ticks: 1 })
        );
        assert_eq!(flx.decode(&[0x90, 0x36, 0x7F]), Some(Intent::JogTouch { deck: Deck::A, touched: true }));
    }

    #[test]
    fn browse_and_load() {
        let mut flx = Flx4::new();
        assert_eq!(flx.decode(&[0xB6, 0x40, 0x01]), Some(Intent::Browse { steps: 1 }));
        assert_eq!(flx.decode(&[0xB6, 0x40, 0x7F]), Some(Intent::Browse { steps: -1 }));
        assert_eq!(flx.decode(&[0x96, 0x47, 0x7F]), Some(Intent::Load { deck: Deck::B }));
        assert_eq!(flx.decode(&[0x96, 0x47, 0x00]), None);
    }

    #[test]
    fn pads_carry_their_mode_deck_and_shift() {
        let mut flx = Flx4::new();
        assert_eq!(
            flx.decode(&[0x97, 0x02, 0x7F]),
            Some(Intent::Pad { deck: Deck::A, mode: PadMode::HotCue, pad: 2, shift: false, pressed: true })
        );
        assert_eq!(
            flx.decode(&[0x9A, 0x67, 0x7F]),
            Some(Intent::Pad { deck: Deck::B, mode: PadMode::BeatLoop, pad: 7, shift: true, pressed: true })
        );
        assert_eq!(
            flx.decode(&[0x99, 0x21, 0x00]),
            Some(Intent::Pad { deck: Deck::B, mode: PadMode::BeatJump, pad: 1, shift: false, pressed: false })
        );
    }

    #[test]
    fn running_status_and_sysex() {
        let mut flx = Flx4::new();
        assert!(flx.decode(&[0x90, 0x0B, 0x7F]).is_some());
        assert_eq!(
            flx.decode(&[0x0B, 0x00]),
            Some(Intent::Button { deck: Deck::A, button: Button::Play, pressed: false })
        );
        assert_eq!(flx.decode(&KEEPALIVE), None);
        assert_eq!(flx.decode(&[]), None);
    }

    #[test]
    fn beat_fx_and_pad_modes() {
        let mut flx = Flx4::new();
        assert_eq!(flx.decode(&[0x94, 0x63, 0x7F]), Some(Intent::FxSelect { previous: false }));
        assert_eq!(flx.decode(&[0x95, 0x4B, 0x7F]), Some(Intent::FxBeat { longer: true }));
        assert_eq!(flx.decode(&[0x95, 0x47, 0x7F]), Some(Intent::FxToggle { off: false }));
        assert_eq!(flx.decode(&[0x94, 0x10, 0x00]), Some(Intent::FxChannel { deck: Deck::A, selected: false }));
        assert_eq!(flx.decode(&[0x95, 0x11, 0x7F]), Some(Intent::FxChannel { deck: Deck::B, selected: true }));
        // [OBS] Every lever move also reports the two crossed notes, always off.
        assert_eq!(flx.decode(&[0x94, 0x11, 0x00]), None);
        assert_eq!(flx.decode(&[0x95, 0x10, 0x00]), None);
        assert_eq!(fader(&mut flx, 0xB4, 0x02, 0x3FFF), Some(Intent::FxDepth { value: 1.0 }));
        assert_eq!(fader(&mut flx, 0xB5, 0x02, 0x2000), Some(Intent::FxDepth { value: 8192.0 / 16_383.0 }));
        assert_eq!(flx.pad_mode(Deck::B), 0x1B);
        assert_eq!(flx.decode(&[0x91, 0x6D, 0x7F]), None);
        assert_eq!(flx.pad_mode(Deck::B), 0x6D);
    }

    #[test]
    fn leds_cover_both_pad_layers() {
        let state = DeckLeds {
            play: true,
            hot_cues: [true, false, false, false, false, false, false, true],
            level: 90,
            pad_mode: 0x1B,
            ..DeckLeds::default()
        };
        let out = leds(Deck::B, &state);
        assert!(out.contains(&[0x91, 0x0B, 0x7F]));
        assert!(out.contains(&[0x91, 0x47, 0x7F]), "PLAY on its SHIFT layer");
        assert!(out.contains(&[0x91, 0x0C, 0x00]));
        assert!(out.contains(&[0x91, 0x10, 0x7F]), "loop buttons lit with no loop");
        assert!(out.contains(&[0x91, 0x4D, 0x00]));
        assert!(out.contains(&[0xB1, 0x02, 90]));
        assert!(out.contains(&[0x91, 0x1B, 0x7F]));
        assert!(out.contains(&[0x99, 0x00, 0x7F]));
        assert!(out.contains(&[0x9A, 0x07, 0x7F]));
        assert!(out.contains(&[0x9A, 0x01, 0x00]));
    }

    #[test]
    fn a_loop_blinks_its_buttons_and_lights_reloop() {
        let looping = DeckLeds { looping: true, blink: false, ..DeckLeds::default() };
        let out = leds(Deck::A, &looping);
        assert!(out.contains(&[0x90, 0x10, 0x00]));
        assert!(out.contains(&[0x90, 0x4D, 0x7F]));
        let out = leds(Deck::A, &DeckLeds { blink: true, ..looping });
        assert!(out.contains(&[0x90, 0x10, 0x7F]));
    }

    #[test]
    fn moving_a_loop_point_blinks_only_its_button() {
        let adjusting = DeckLeds { looping: true, blink: true, loop_adjust: 2, ..DeckLeds::default() };
        let out = leds(Deck::A, &adjusting);
        assert!(out.contains(&[0x90, 0x11, 0x7F]));
        assert!(out.contains(&[0x90, 0x10, 0x00]), "the other end stays dark");
    }

    #[test]
    fn all_off_puts_out_everything_lit_once() {
        let off = all_off();
        assert!(off.iter().all(|[_, _, value]| *value == 0));
        let mut unique = off.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), off.len(), "no LED twice");
        let lit = DeckLeds {
            play: true, cue: true, sync: true, looping: true, channel_cue: true, hot_cues: [true; 8], pad_mode: 0x6F,
            blink: true, level: 127, loop_adjust: 0,
        };
        for deck in Deck::ALL {
            for [status, data, _] in leds(deck, &lit) {
                assert!(off.contains(&[status, data, 0]), "{status:#x} {data:#x} is put out");
            }
        }
        for [status, data, _] in fx_leds(true) {
            assert!(off.contains(&[status, data, 0]));
        }
        assert!(off.contains(&[0x96, 0x63, 0]));
        assert!(off.contains(&[0x9A, 0x77, 0]), "the last pad of the last mode on deck 2 with SHIFT");
        assert!(off.contains(&[0x90, 0x1B, 0]) && off.contains(&[0x91, 0x6F, 0]), "pad mode buttons");
        assert!(off.contains(&[0xB1, 0x02, 0]), "the channel meter");
    }

    #[test]
    fn track_loaded_names_the_deck() {
        assert_eq!(track_loaded(Deck::A), [0x9F, 0x00, 0x7F]);
        assert_eq!(track_loaded(Deck::B), [0x9F, 0x01, 0x7F]);
    }

    #[test]
    fn intents_reach_the_interface_as_tagged_json() {
        let json = serde_json::to_string(&Intent::Pad {
            deck: Deck::A,
            mode: PadMode::BeatJump,
            pad: 3,
            shift: false,
            pressed: true,
        })
        .unwrap();
        assert_eq!(json, r#"{"type":"pad","deck":"a","mode":"beatJump","pad":3,"shift":false,"pressed":true}"#);
    }
}
