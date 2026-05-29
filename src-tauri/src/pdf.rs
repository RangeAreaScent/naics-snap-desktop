//! Collection -> PDF export, generated natively with printpdf 0.8.
//!
//! The WebView's window.print() is unreliable across platforms (unsupported
//! in macOS WKWebView), so the PDF is built here. The bundled NanumGothic
//! font is embedded so Korean (and other non-Latin) text renders correctly;
//! printpdf subsets the font to just the glyphs used, keeping output small.

use printpdf::*;
use serde::Deserialize;

/// NanumGothic (SIL OFL 1.1). License: src-tauri/resources/fonts/OFL.txt
const NANUM_REGULAR: &[u8] = include_bytes!("../resources/fonts/NanumGothic-Regular.ttf");
const NANUM_BOLD: &[u8] = include_bytes!("../resources/fonts/NanumGothic-Bold.ttf");

#[derive(Deserialize)]
pub struct ExportEntry {
    pub code: String,
    pub title: String,
    pub note: String,
    pub sector: String,
    pub subsector: String,
    pub industry_group: String,
    pub industry: String,
    pub sba_size: String,
}

// US Letter, in millimetres.
const PAGE_W: f32 = 215.9;
const PAGE_H: f32 = 279.4;
const MARGIN: f32 = 18.0;
const BOTTOM_LIMIT: f32 = 16.0;
const MM_PER_PT: f32 = 0.352_777_8;

fn mm_to_pt(mm: f32) -> f32 {
    mm / MM_PER_PT
}

fn char_units(c: char) -> usize {
    let u = c as u32;
    let wide = (0x1100..=0x11FF).contains(&u)
        || (0x2E80..=0xA4CF).contains(&u)
        || (0xAC00..=0xD7A3).contains(&u)
        || (0xF900..=0xFAFF).contains(&u)
        || (0xFF00..=0xFF60).contains(&u);
    if wide {
        2
    } else {
        1
    }
}

fn units(s: &str) -> usize {
    s.chars().map(char_units).sum()
}

fn wrap(s: &str, font_size: f32, avail_mm: f32) -> Vec<String> {
    let unit_mm = 0.5 * font_size * MM_PER_PT;
    let max_units = ((avail_mm / unit_mm).floor() as usize).max(8);
    let mut lines: Vec<String> = Vec::new();

    for raw in s.split('\n') {
        let mut cur = String::new();
        let mut cur_units = 0;
        for word in raw.split_whitespace() {
            let w_units = units(word);
            if cur.is_empty() {
                cur = word.to_string();
                cur_units = w_units;
            } else if cur_units + 1 + w_units <= max_units {
                cur.push(' ');
                cur.push_str(word);
                cur_units += 1 + w_units;
            } else {
                lines.push(std::mem::take(&mut cur));
                cur = word.to_string();
                cur_units = w_units;
            }
            while cur_units > max_units {
                let mut head = String::new();
                let mut head_units = 0;
                let mut rest = cur.chars().peekable();
                while let Some(&c) = rest.peek() {
                    let cu = char_units(c);
                    if head_units + cu > max_units {
                        break;
                    }
                    head.push(c);
                    head_units += cu;
                    rest.next();
                }
                lines.push(head);
                cur = rest.collect();
                cur_units = units(&cur);
            }
        }
        lines.push(cur);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

struct Layout {
    regular: FontId,
    bold: FontId,
    pages: Vec<Vec<Op>>,
    cur: Vec<Op>,
    y: f32,
}

impl Layout {
    fn new(regular: FontId, bold: FontId) -> Self {
        Self {
            regular,
            bold,
            pages: Vec::new(),
            cur: vec![Op::StartTextSection],
            y: PAGE_H - MARGIN,
        }
    }

    fn new_page(&mut self) {
        self.cur.push(Op::EndTextSection);
        let finished = std::mem::replace(&mut self.cur, vec![Op::StartTextSection]);
        self.pages.push(finished);
        self.y = PAGE_H - MARGIN;
    }

    fn gap(&mut self, mm: f32) {
        self.y -= mm;
        if self.y < BOTTOM_LIMIT {
            self.new_page();
        }
    }

    fn text(&mut self, s: &str, size: f32, indent: f32, bold: bool) {
        let font = if bold {
            self.bold.clone()
        } else {
            self.regular.clone()
        };
        let line_h = size * 1.34 * MM_PER_PT;
        let avail = PAGE_W - 2.0 * MARGIN - indent;
        for line in wrap(s, size, avail) {
            if self.y < BOTTOM_LIMIT {
                self.new_page();
            }
            let x = mm_to_pt(MARGIN + indent);
            let y = mm_to_pt(self.y);
            self.cur.push(Op::SetTextMatrix {
                matrix: TextMatrix::Translate(Pt(x), Pt(y)),
            });
            self.cur.push(Op::SetFontSize {
                size: Pt(size),
                font: font.clone(),
            });
            self.cur.push(Op::WriteText {
                items: vec![TextItem::Text(line)],
                font: font.clone(),
            });
            self.y -= line_h;
        }
    }

    fn finish(mut self) -> Vec<PdfPage> {
        if self.cur.len() > 1 {
            self.cur.push(Op::EndTextSection);
            self.pages.push(self.cur);
        }
        if self.pages.is_empty() {
            self.pages
                .push(vec![Op::StartTextSection, Op::EndTextSection]);
        }
        self.pages
            .into_iter()
            .map(|ops| PdfPage::new(Mm(PAGE_W), Mm(PAGE_H), ops))
            .collect()
    }
}

pub fn export(path: &str, title: &str, entries: &[ExportEntry]) -> Result<(), String> {
    let mut doc = PdfDocument::new(title);
    let regular = ParsedFont::from_bytes(NANUM_REGULAR, 0, &mut Vec::new())
        .ok_or_else(|| "failed to parse embedded font".to_string())?;
    let bold = ParsedFont::from_bytes(NANUM_BOLD, 0, &mut Vec::new())
        .ok_or_else(|| "failed to parse embedded bold font".to_string())?;
    let regular_id = doc.add_font(&regular);
    let bold_id = doc.add_font(&bold);

    let mut layout = Layout::new(regular_id, bold_id);

    layout.text(title, 18.0, 0.0, true);
    layout.gap(1.5);
    layout.text(
        &format!("{} codes  -  NAICS 2022", entries.len()),
        9.0,
        0.0,
        false,
    );
    layout.gap(5.0);

    for e in entries {
        layout.text(&e.code, 13.0, 0.0, true);
        layout.text(&e.title, 10.5, 0.0, false);
        if !e.note.trim().is_empty() {
            layout.text(&format!("Note: {}", e.note), 9.5, 5.0, false);
        }
        let mut meta_parts: Vec<String> = Vec::new();
        if !e.sector.is_empty() {
            meta_parts.push(format!("Sector: {}", e.sector));
        }
        if !e.subsector.is_empty() {
            meta_parts.push(format!("Subsector: {}", e.subsector));
        }
        if !e.industry_group.is_empty() {
            meta_parts.push(format!("Group: {}", e.industry_group));
        }
        if !e.industry.is_empty() {
            meta_parts.push(format!("Industry: {}", e.industry));
        }
        if !e.sba_size.is_empty() {
            meta_parts.push(format!("SBA: {}", e.sba_size));
        }
        if !meta_parts.is_empty() {
            layout.text(&meta_parts.join("   |   "), 8.5, 5.0, false);
        }
        layout.gap(4.5);
    }

    let pages = layout.finish();
    let bytes = doc
        .with_pages(pages)
        .save(&PdfSaveOptions::default(), &mut Vec::new());
    std::fs::write(path, bytes).map_err(|e| format!("cannot write PDF: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(code: &str, note: &str) -> ExportEntry {
        ExportEntry {
            code: code.into(),
            title: "Computer Systems Design Services with a fairly long \
                title so word wrapping and page flow are exercised"
                .into(),
            note: note.into(),
            sector: "Professional, Scientific, and Technical Services".into(),
            subsector: "Professional, Scientific, and Technical Services".into(),
            industry_group: "Computer Systems Design and Related Services".into(),
            industry: "Computer Systems Design and Related Services".into(),
            sba_size: "$34M annual receipts".into(),
        }
    }

    #[test]
    fn produces_a_valid_ascii_pdf() {
        let path = std::env::temp_dir().join("naicssnap_pdf_ascii.pdf");
        let path = path.to_str().unwrap();
        let entries: Vec<ExportEntry> = (0..40)
            .map(|i| entry(&format!("5415{i:02}"), if i % 3 == 0 { "Coverage" } else { "" }))
            .collect();
        export(path, "Test Collection", &entries).expect("export should succeed");

        let bytes = std::fs::read(path).expect("output file should exist");
        assert_eq!(&bytes[..5], b"%PDF-", "missing PDF header");
        assert!(bytes.windows(5).any(|w| w == b"%%EOF"), "missing EOF marker");
    }

    #[test]
    fn produces_a_small_korean_pdf() {
        let path = std::env::temp_dir().join("naicssnap_pdf_korean.pdf");
        let path = path.to_str().unwrap();
        let entries = vec![entry("541512", "한국어 메모 — 컴퓨터 시스템 디자인")];
        export(path, "한국 코드 모음", &entries).expect("korean export should succeed");

        let bytes = std::fs::read(path).expect("output file should exist");
        assert_eq!(&bytes[..5], b"%PDF-", "missing PDF header");
        assert!(
            bytes.len() < 400_000,
            "korean pdf is {} bytes — font subsetting may have failed",
            bytes.len(),
        );
    }

    #[test]
    fn wrap_handles_long_words_and_cjk() {
        assert_eq!(wrap("", 10.0, 100.0), vec![String::new()]);
        assert!(wrap(&"x".repeat(500), 10.0, 80.0).len() > 1, "long word must wrap");
        assert!(wrap(&"가".repeat(200), 10.0, 80.0).len() > 1, "long Korean run must wrap");
    }
}
