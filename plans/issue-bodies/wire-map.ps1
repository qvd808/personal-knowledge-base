$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "qvd808/personal-knowledge-base"

# database ids for map + children
$ids = @{}
foreach ($n in 35..40) {
	$id = & $gh api "repos/$repo/issues/$n" --jq ".id"
	$ids[$n] = $id
	Write-Host "issue #$n db-id=$id"
}

# attach children 36-40 as sub-issues of map 35
foreach ($child in 36..40) {
	& $gh api --method POST "repos/$repo/issues/35/sub_issues" -F "sub_issue_id=$($ids[$child])" --jq ".number"
	Write-Host "attached #$child as sub-issue of #35"
}

# native blocking: 37 blocked_by 36; 38 blocked_by 37; 39 blocked_by 38
$edges = @(@(37, 36), @(38, 37), @(39, 38))
foreach ($e in $edges) {
	$child = $e[0]; $blocker = $e[1]
	& $gh api --method POST "repos/$repo/issues/$child/dependencies/blocked_by" -F "issue_id=$($ids[$blocker])" --jq ".number"
	Write-Host "#$child blocked_by #$blocker"
}
