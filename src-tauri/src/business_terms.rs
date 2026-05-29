//! Business-vocabulary shortcut expansion. Ported from the iOS app's
//! `BusinessTerms.swift`. Each expansion is chosen so the phrase appears
//! verbatim in at least one 2022 NAICS index entry, title, or description.

const DICTIONARY: &[(&str, &str)] = &[
    // Tech / software
    ("SAAS", "software"),
    ("PAAS", "software"),
    ("IAAS", "data processing hosting"),
    ("DEV", "programming"),
    ("DEVOPS", "computer systems design"),
    ("SWE", "computer programming"),
    ("QA", "computer systems design"),
    ("AI", "data processing"),
    ("ML", "data processing"),
    ("API", "computer systems design"),
    ("UX", "graphic design"),
    ("UI", "graphic design"),
    ("ETL", "data processing"),
    ("BI", "management consulting"),
    ("IT", "computer systems"),
    ("MSP", "computer facilities management"),
    ("VPN", "telecommunications"),
    ("ISP", "internet service"),
    ("CDN", "data processing"),

    // E-commerce / retail
    ("DTC", "electronic shopping"),
    ("D2C", "electronic shopping"),
    ("B2B", "wholesale"),
    ("B2C", "retail"),
    ("FBA", "warehousing"),
    ("POS", "retail"),
    ("SKU", "merchant wholesalers"),

    // Finance / accounting
    ("CPA", "accountants"),
    ("EA", "tax preparation"),
    ("CFO", "financial"),
    ("VC", "venture capital"),
    ("PE", "investment"),
    ("PNL", "accountants"),
    ("GL", "accountants"),
    ("AR", "accountants"),
    ("AP", "accountants"),
    ("401K", "retirement"),
    ("IRA", "retirement"),
    ("ETF", "securities"),
    ("REIT", "real estate investment trusts"),

    // Marketing / media
    ("SEO", "marketing consulting"),
    ("SEM", "advertising"),
    ("PPC", "advertising"),
    ("CTR", "advertising"),
    ("CRO", "marketing"),
    ("PR", "public relations"),
    ("OOH", "outdoor advertising"),
    ("DTM", "direct mail"),

    // Legal / professional
    ("LLC", "offices of lawyers"),
    ("LLP", "offices of lawyers"),
    ("IP", "patent"),

    // Health-adjacent
    ("DME", "medical equipment"),
    ("HMO", "health insurance"),
    ("PPO", "health insurance"),
    ("EHR", "computer systems design"),
    ("EMR", "computer systems design"),

    // Trades / construction
    ("HVAC", "heating"),
    ("GC", "general contractor"),
    ("MEP", "construction"),
    ("EPC", "construction"),

    // Logistics / supply chain
    ("3PL", "warehousing"),
    ("LTL", "trucking"),
    ("FTL", "trucking"),
    ("OTR", "trucking"),
    ("WMS", "warehousing"),
    ("TMS", "transportation"),

    // Food / hospitality
    ("QSR", "limited-service restaurants"),
    ("FSR", "full-service restaurants"),
    ("STR", "traveler accommodation"),

    // Real estate
    ("MLS", "real estate agents"),
    ("HOA", "real estate property managers"),
    ("CRE", "commercial real estate"),

    // General business
    ("HR", "human resources"),
    ("SMB", "small business"),
    ("SBA", "small business"),
    ("GSA", "administration"),
    ("DOD", "national security"),
    ("FED", "federal"),
    ("GOV", "administration"),
    ("NGO", "civic and social organizations"),
];

fn lookup(token: &str) -> Option<&'static str> {
    let key = token.to_uppercase();
    DICTIONARY
        .iter()
        .find(|(abbr, _)| *abbr == key)
        .map(|(_, phrase)| *phrase)
}

/// Expands tokens within a multi-word query. Tokens that match a known
/// abbreviation are replaced; everything else is preserved verbatim.
/// Non-alphanumeric characters are treated as token separators.
pub fn expand(query: &str) -> String {
    let tokens: Vec<&str> = query
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .collect();
    if tokens.is_empty() {
        return query.trim().to_string();
    }
    tokens
        .iter()
        .map(|t| lookup(t).unwrap_or(t).to_string())
        .collect::<Vec<_>>()
        .join(" ")
}
