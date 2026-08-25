$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "qvd808/personal-knowledge-base"
$map = 35

$tickets = @(
	@{ label = "wayfinder:research"; title = "Does Quartz render Obsidian block references?"; body = "plans/issue-bodies/t1-quartz-block-refs.md" },
	@{ label = "wayfinder:grilling"; title = "Lock the anchor strategy for resource wikilinks"; body = "plans/issue-bodies/t2-anchor-strategy.md" },
	@{ label = "wayfinder:grilling"; title = "Spec the resource harvester module"; body = "plans/issue-bodies/t3-harvester-spec.md" },
	@{ label = "wayfinder:task"; title = "Migrate existing links into the harvester model"; body = "plans/issue-bodies/t4-migration.md" },
	@{ label = "wayfinder:grilling"; title = "Spec the diff-gated change-review workflow"; body = "plans/issue-bodies/t5-change-review-spec.md" }
)

foreach ($t in $tickets) {
	$tmp = [System.IO.Path]::GetTempFileName()
	$content = "Part of #$map`n`n" + (Get-Content $t.body -Raw)
	Set-Content -Path $tmp -Value $content -NoNewline
	& $gh issue create -R $repo --label $t.label --title $t.title --body-file $tmp
	Remove-Item $tmp
}
