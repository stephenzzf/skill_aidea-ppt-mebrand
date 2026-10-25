# ME2026 Template Assets

Current branding uses the user-provided `ME PPT 模版（2）.pptx`. Historical backgrounds and retained assets originate from the earlier ME2026 / WhatsApp industry PPTX.

- `cover-glass-bg.png`: current full-slide cover and Thank You background, extracted without modification from `slideLayout1` / `ppt/media/image1.png` in `ME PPT 模版（2）.pptx`. Source hash and extraction details are in `cover-glass-bg.source.json`; keep it as a separate decorative image under editable text and shapes.
- `cover-bg.jpg`: historical ME2026 cover background with the PPTX crop and horizontal flip applied; not the current default.
- `index-bg.jpg`: index-page right-side background with the PPTX crop and horizontal flip applied.
- `meet-experience-bilingual.png`: 觅跃科技 / MEET EXPERIENCE transparent color logo for cover, index and closing only, cropped losslessly from `ppt/media/image2.png` in the user-provided template. Source hash, alpha bounds and output hash are recorded in `meet-experience-bilingual.source.json`. The user selected this color logo for the compact transparent cover placement; use proportional sizing and retain the original colors and lettering, with no white backplate. Ordinary body pages retain the existing MEET EXPERIENCE + divider + MeetSocial Group footer.
- `meet-experience-bilingual-reverse.png`: light reverse logo retained as an alternate, cropped losslessly from `ppt/media/image4.png` in the same user template; it is not the default cover mark. Provenance is in its `.source.json`. Use only when explicitly selected, without recoloring or adding a white panel.
- `meetsocial-group-logo.png`: historical cover MeetSocial Group logo; retained for existing documents, not the new default.
- `meet-experience-cover-logo.png`: historical English-only cover logo.
- `meet-experience-footer-logo.png`: standard body-page English-only footer logo rendered from the PPTX SVG.
- `meetsocial-footer-logo.png`: standard body-page MeetSocial Group footer logo.
- `thank-you-bg.jpg`: historical Thank You page left-side background, cropped from the source PPTX final slide; current Thank You pages use `cover-glass-bg.png` full-slide.
- `thank-you-meetsocial-logo.png`: historical Thank You page MeetSocial Group logo; current closing uses the bilingual logo.
- `thank-you-official-qr.jpg`: default Thank You page MEET EXPERIENCE official account QR image.
- `deloitte-white-icons/`: optional icon geometry extracted from the user-provided Deloitte `.potx`, converted from OOXML custom shapes to transparent SVG/PNG, and recolored with ME2026 colors.

The source PPTX right-side contact-solution QR is intentionally omitted from this public template. The default Thank You page uses editable placeholder text `黏贴个人联系方式` in that position.

No AI-generated image assets are used in this folder. Confirm authorization before redistributing these brand assets outside the approved GitHub / Openclaw distribution path.

The default Thank You page assets come from the source PPTX final slide (`slide37`). The source package's `slide27` is a section divider, not the Contact Us / Thank You page.

The Deloitte-derived icon subset uses only white-background appendix slides (`slide296-slide315`) and explicitly ignores the black timeline page (`slide205`) and other dark/Deloitte-branded pages. This is an icon asset collection for standard ME2026, not an alternative generation style. These icons should be redistributed only when the source-template asset rights allow it.
