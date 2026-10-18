# F-003: Stories

## ST-003.1 · Test names with quote characters inside
**Intent:** As the developer reading coverage, I want a test named with an apostrophe or quotes to count as a proper marker so that the Verification screen doesn't downgrade it to a mention.

### S-003.1.1 · An apostrophe in a double-quoted title {happy}
- **GIVEN** a test file containing `it("S-001.1.2 doesn't count", () => {})`
- **WHEN** it is scanned
- **THEN** S-001.1.2 has one reference with confidence `marker` and name `S-001.1.2 doesn't count`

### S-003.1.2 · Double quotes in a single-quoted title {edge}
- **GIVEN** a test file containing `it('S-001.1.3 says "hi"', () => {})`
- **WHEN** it is scanned
- **THEN** S-001.1.3 has one reference with confidence `marker` and name `S-001.1.3 says "hi"`

### S-003.1.3 · An escaped quote of the same kind {edge}
- **GIVEN** a test file containing `it('S-001.1.4 isn\'t lost', () => {})`
- **WHEN** it is scanned
- **THEN** S-001.1.4 has one reference with confidence `marker` and name `S-001.1.4 isn't lost`

### S-003.1.4 · An ID in a plain string {negative}
- **GIVEN** a test file containing `const note = "S-001.1.5 doesn't apply";`
- **WHEN** it is scanned
- **THEN** S-001.1.5 has one reference with confidence `fallback`
