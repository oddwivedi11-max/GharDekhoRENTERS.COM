from pathlib import Path

path = Path("index.html")
source = path.read_text(encoding="utf-8")

replacements = [
    (
        'if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;',
        'if (!currentUser || !accountHasRole("owner")) return;',
        3,
    ),
    (
        'if (!currentUser || !accountHasRole("owner") || activeRole !== "owner") {',
        'if (!currentUser || !accountHasRole("owner")) {',
        1,
    ),
    (
        'let statusLabel = "Vacant";\n                    let statusClass = "available";\n                    if (property.status === "occupied") {',
        'let statusLabel = "Vacant";\n                    let statusClass = "available";\n                    if (property.status === "pending" || property.verification_status === "pending") {\n                        statusLabel = "Pending verification";\n                        statusClass = "pending";\n                    } else if (property.status === "occupied") {',
        1,
    ),
]

for old, new, expected in replacements:
    actual = source.count(old)
    if actual != expected:
        raise SystemExit(f"Owner dashboard patch stopped safely: expected {expected} matches, found {actual} for {old[:90]!r}")
    source = source.replace(old, new)

path.write_text(source, encoding="utf-8")
print("Applied owner dashboard refresh and pending-status fixes.")
