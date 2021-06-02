const github = require('@actions/github');
const {
    Octokit
} = require("@octokit/rest")

const token = process.env["INPUT_GITHUB_TOKEN"]

console.log("Token first 2 chars: " + (token || "").substring(0, 2))

const octokit = new Octokit({
    auth: token,
    userAgent: "gitdiscipline 0.0.1"
})

const owner = "glennmcavoy"
const repo = "testerrrr"

async function run() {
    if (!github.context.payload) {
        throw new Error("no payload");
    }

    if (github.context.payload.action !== "opened") {
        return;
    }

    const pull_number = github.context.payload.number
    const {
        data: pr
    } = await octokit.rest.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: pull_number
    });

    const title = pr.title
    const issueIds = [...title.matchAll(/#(\d+)/g)].map(i => i[1])

    const violations = [];

    async function dispatchRuleViolationWarning() {
        await violations.forEach(async (violation) => {
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: pull_number,
                body: violation,
            })

        })
        await octokit.issues.addLabels({
            owner,
            repo,
            issue_number: pull_number,
            labels: [
                'closed-rule'
            ]
        });
        await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number,
            state: "closed"

        });
        return
    }

    if (issueIds.length == 0) {
        violations.push("Rule issue. Title does not reference any open issues. Use #123 syntax in title.")
    }

    const acceptedVerbs = [
        "Add",
        "Remove",
        "Change",
        "Improve",
        "Fix",
        "Implement"
    ]

    if (!acceptedVerbs.find(av => title.indexOf(av) === 0)) {
        violations.push(`Rule issue. Title does not start with an acceptable verb. Use ${acceptedVerbs.map(av => "'" + av + "'")}`)
    }

    if (title.length > 69) {
        violations.push("Rule issue. Title must be less than 70 chars.")
    }

    const bannedWords = [
        "wip",
        "in progress"]

    if(bannedWords.find(bw => title.toLowerCase().includes(bw))) {
        violations.push(`Rule issue. Title includes one or more banned words. Remove ${bannedWords.map(bw => "'" + bw + "'").join(", ")}`)
    }

    if (!acceptedVerbs.find(av => title.indexOf(av) === 0)) {
        // must be sufficiently descriptiove
    }
	
	if (violations.length > 0) {
        await dispatchRuleViolationWarning()
		return
    }

    for (const issueId of issueIds) {
        try {
            const {
                data: issue
            } = await octokit.rest.issues.get({
                owner: owner,
                repo: repo,
                issue_number: issueId,
            });
        } catch (e) {
            console.error(e.status)
        }
    }

}

run().then(() => null).catch(e => {
    console.error(e)
    process.exit(1)
})