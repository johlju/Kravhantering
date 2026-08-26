/** Compatibility names for MCP workflows that still expose search metadata. */
export {
  compareSearchMatches as compareMcpSearchMatches,
  findSearchMatch as findMcpSearchMatch,
  normalizeSearchText as normalizeMcpSearchText,
  type SearchMatch as McpSearchMatch,
  type SearchMatchQuality as McpSearchMatchQuality,
} from '@/lib/requirements/search-match'
