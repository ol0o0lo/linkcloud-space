# Accounts Architecture Notes

`apps/accounts` should prefer top-level imports and clear module boundaries.

Normal, reasonable architecture should not rely on local imports to hide dependency problems.
If a module needs a local import to stay importable, that is a sign to re-check the dependency direction and split responsibilities more cleanly.
