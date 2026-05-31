//! Premium license activation via the Lemon Squeezy license API.
//!
//! Flow: the user enters a key -> `activate` registers this machine as an
//! "instance" (Lemon Squeezy enforces the per-key device limit server-side).
//! The key + instance id are stored locally; `validate` re-checks on launch
//! but tolerates being offline so a verified user is never locked out by a
//! flaky network or a Lemon Squeezy outage.
//!
//! A separate "override" flag (toggled by the hidden version-tap rhythm) is
//! OR-ed into the unlocked state for demos / testing — it never touches the
//! real license, mirroring the iOS app's debug unlock.

use crate::store;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::Duration;

const ACTIVATE_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/activate";
const VALIDATE_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/validate";
const DEACTIVATE_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/deactivate";
const STORE_NAME: &str = "license";
const OVERRIDE_STORE: &str = "premium_override";
const INSTANCE_NAME: &str = "NAICS Snap Desktop";

/// Lemon Squeezy product id this binary accepts license keys for.
/// `0` disables the check (any key for any product in the LS account works).
/// Set to the real product id from the LS dashboard URL before v1.0.0.
const EXPECTED_PRODUCT_ID: u64 = 0;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LicenseState {
    pub unlocked: bool,
    pub key: Option<String>,
    pub instance_id: Option<String>,
}

#[derive(Deserialize)]
struct ActivateResp {
    activated: bool,
    error: Option<String>,
    instance: Option<Instance>,
    meta: Option<Meta>,
}

#[derive(Deserialize)]
struct Instance {
    id: String,
}

#[derive(Deserialize)]
struct ValidateResp {
    valid: bool,
    meta: Option<Meta>,
}

#[derive(Deserialize)]
struct Meta {
    product_id: u64,
}

fn product_id_ok(meta: &Option<Meta>) -> bool {
    EXPECTED_PRODUCT_ID == 0
        || meta.as_ref().map(|m| m.product_id) == Some(EXPECTED_PRODUCT_ID)
}

fn save(dir: &Path, state: &LicenseState) -> Result<(), String> {
    let json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    store::write(dir, STORE_NAME, &json)
}

fn load_license(dir: &Path) -> LicenseState {
    match store::read(dir, STORE_NAME) {
        Ok(Some(raw)) => serde_json::from_str(&raw).unwrap_or_default(),
        _ => LicenseState::default(),
    }
}

fn override_on(dir: &Path) -> bool {
    matches!(store::read(dir, OVERRIDE_STORE), Ok(Some(raw)) if raw.trim() == "true")
}

fn set_override(dir: &Path, on: bool) -> Result<(), String> {
    store::write(dir, OVERRIDE_STORE, if on { "true" } else { "false" })
}

fn with_override(dir: &Path, mut s: LicenseState) -> LicenseState {
    if override_on(dir) {
        s.unlocked = true;
    }
    s
}

pub fn status(dir: &Path) -> LicenseState {
    with_override(dir, load_license(dir))
}

fn post_form(url: &str, fields: &[(&str, &str)]) -> Result<String, String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(12))
        .build();
    match agent
        .post(url)
        .set("Accept", "application/json")
        .send_form(fields)
    {
        Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(_, resp)) => resp.into_string().map_err(|e| e.to_string()),
        Err(e) => Err(format!("Could not reach the license server: {e}")),
    }
}

pub fn activate(dir: &Path, key: &str) -> Result<LicenseState, String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("Please enter a license key.".into());
    }

    let body = post_form(
        ACTIVATE_URL,
        &[("license_key", key), ("instance_name", INSTANCE_NAME)],
    )?;
    let resp: ActivateResp = serde_json::from_str(&body)
        .map_err(|_| "Unexpected response from the license server.".to_string())?;

    if !resp.activated || !product_id_ok(&resp.meta) {
        return Err(resp.error.unwrap_or_else(|| {
            "This license key is not valid for NAICS Snap.".into()
        }));
    }

    let state = LicenseState {
        unlocked: true,
        key: Some(key.to_string()),
        instance_id: resp.instance.map(|i| i.id),
    };
    save(dir, &state)?;
    Ok(with_override(dir, state))
}

pub fn validate(dir: &Path) -> LicenseState {
    let stored = load_license(dir);

    let real = match (stored.key.clone(), stored.instance_id.clone()) {
        (Some(key), Some(instance_id)) => {
            match post_form(
                VALIDATE_URL,
                &[("license_key", &key), ("instance_id", &instance_id)],
            ) {
                Err(_) => stored,
                Ok(body) => match serde_json::from_str::<ValidateResp>(&body) {
                    Ok(resp) if resp.valid && product_id_ok(&resp.meta) => stored,
                    Ok(_) => {
                        let _ = save(dir, &LicenseState::default());
                        LicenseState::default()
                    }
                    Err(_) => stored,
                },
            }
        }
        _ => LicenseState::default(),
    };

    with_override(dir, real)
}

pub fn deactivate(dir: &Path) -> Result<LicenseState, String> {
    let stored = load_license(dir);
    if let (Some(key), Some(instance_id)) = (&stored.key, &stored.instance_id) {
        let _ = post_form(
            DEACTIVATE_URL,
            &[("license_key", key), ("instance_id", instance_id)],
        );
    }
    save(dir, &LicenseState::default())?;
    Ok(with_override(dir, LicenseState::default()))
}

pub fn toggle_override(dir: &Path) -> Result<LicenseState, String> {
    set_override(dir, !override_on(dir))?;
    Ok(status(dir))
}
