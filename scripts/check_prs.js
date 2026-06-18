const REPO = 'nfbrentano/azure-devops-dashboard';

async function checkPRs() {
    const response = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=open`);
    const prs = await response.json();

    console.log(`Found ${prs.length} open PRs:\n`);

    for (const pr of prs) {
        const statusResponse = await fetch(pr.statuses_url);
        const statuses = await statusResponse.json();
        
        // Also check check-runs
        const checkRunsResponse = await fetch(`${pr.base.repo.url}/commits/${pr.head.sha}/check-runs`);
        const checkRuns = await checkRunsResponse.json();

        let allPassed = true;
        let summary = [];

        if (statuses.length > 0) {
            const latestStatus = statuses[0].state;
            summary.push(`Status: ${latestStatus}`);
            if (latestStatus !== 'success') allPassed = false;
        }

        if (checkRuns.check_runs) {
            for (const run of checkRuns.check_runs) {
                summary.push(`Check: ${run.name} (${run.conclusion || run.status})`);
                if (run.conclusion !== 'success' && run.status !== 'completed') allPassed = false;
                if (run.conclusion === 'failure') allPassed = false;
            }
        }

        console.log(`[#${pr.number}] ${pr.title}`);
        console.log(`URL: ${pr.html_url}`);
        console.log(`Checks: ${summary.join(', ') || 'No checks found'}`);
        console.log(`Overall: ${allPassed ? '✅ PASSING' : '⚠️ ATTENTION NEEDED'}`);
        console.log('---');
    }
}

checkPRs().catch(console.error);
