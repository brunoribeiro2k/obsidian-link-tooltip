/*
 * Prepare a release PR.
 *
 * The local half of the release flow: bump the version, put it on a
 * `release/<version>` branch, commit, push, and open a PR to master. Merging
 * that PR is what triggers the release workflow, which tags the merged commit
 * and drafts the GitHub release — so this script deliberately never creates a
 * git tag (`.npmrc` sets `git-tag-version=false`; the workflow owns tags, and a
 * local tag would collide with the one it pushes).
 *
 *   npm run release -- <patch|minor|major>
 *
 * The branch is release/<version>. If you're already on a release branch for the
 * bumped version — including one you named with a descriptive suffix like
 * release/<version>-first-final — it's kept rather than switched to the bare
 * name.
 *
 * Refuses to run on a dirty tree so the release commit contains only the bump,
 * and reuses an existing PR/branch instead of erroring if one is already open.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BUMP_TYPES = new Set(["patch", "minor", "major"]);

const bump = process.argv[2];
if (!BUMP_TYPES.has(bump)) {
	console.error("Usage: npm run release -- <patch|minor|major>");
	process.exit(1);
}

const capture = (command) => execSync(command, { encoding: "utf8" }).trim();
const run = (command) => execSync(command, { stdio: "inherit" });

// 1. Only bump from a clean tree, so the commit is just the version change.
if (capture("git status --porcelain")) {
	console.error("Working tree is not clean. Commit or stash changes first.");
	process.exit(1);
}

// 2. Bump the version everywhere (version-bump.mjs syncs manifest.json and
//    versions.json via the `version` lifecycle). No tag — the workflow tags.
run(`npm version ${bump}`);
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// 3. Land the bump on a release branch, carrying the uncommitted changes over.
//    The branch is release/<version>, but if we're already on a release branch
//    for this version — including one named with a descriptive suffix like
//    release/<version>-first-final — keep it rather than switching to the bare
//    name.
const current = capture("git rev-parse --abbrev-ref HEAD");
const escaped = version.replace(/[.]/g, "\\.");
const onReleaseBranch = new RegExp(`^release/${escaped}(-.+)?$`).test(current);
const branch = onReleaseBranch ? current : `release/${version}`;

if (current !== branch) {
	run(capture(`git branch --list ${branch}`) ? `git checkout ${branch}` : `git checkout -b ${branch}`);
}

// 4. Commit and push.
run("git add -A");
run(`git commit -m "chore(release): ${version}"`);
run(`git push -u origin ${branch}`);

// 5. Open the PR, or point at the existing one.
const title = `chore(release): ${version}`;
let prUrl = "";
try {
	prUrl = capture(`gh pr list --head ${branch} --base master --state open --json url --jq ".[0].url // \\"\\""`);
} catch {
	// gh missing or unauthenticated — handled below.
}

if (prUrl) {
	console.log(`\nRelease PR already open: ${prUrl}`);
} else {
	try {
		const body = `Release ${version}. Merging tags the version and drafts the GitHub release.`;
		const url = capture(`gh pr create --base master --head ${branch} --title "${title}" --body "${body}"`);
		console.log(`\nOpened release PR: ${url}`);
	} catch {
		console.log(`\nBranch pushed. Open the PR manually:\n  gh pr create --base master --head ${branch} --title "${title}"`);
	}
}

console.log(`\nNext: merge the PR — the workflow tags ${version} and drafts the release.`);
