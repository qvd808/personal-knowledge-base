/**
 * Malformed vault state the harvester refuses to guess at (#38 §6): output
 * integrity failures only — hash collisions, unbalanced generated markers,
 * sustained ids missing from the registry. Input quality is never an error
 * here; it belongs to vault-lint's findings tier.
 */
export class ResourceHarvesterError extends Error {}
