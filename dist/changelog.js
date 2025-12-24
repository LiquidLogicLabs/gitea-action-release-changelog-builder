"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChangelog = generateChangelog;
/**
 * Generate changelog from pull requests using configuration
 */
function generateChangelog(pullRequests, config, tagAnnotation, prefixMessage, postfixMessage) {
    // Categorize pull requests
    const categorized = categorizePullRequests(pullRequests, config.categories || [], config.ignore_labels || []);
    // Build changelog sections
    const sections = [];
    // Add prefix message if provided
    if (prefixMessage) {
        sections.push(prefixMessage);
        sections.push('');
    }
    // Add tag annotation if provided
    if (tagAnnotation) {
        sections.push(tagAnnotation);
        sections.push('');
    }
    // Build categorized sections
    for (const category of config.categories || []) {
        const prs = categorized.get(category.title) || [];
        if (prs.length > 0) {
            sections.push(category.title);
            sections.push('');
            for (const pr of prs) {
                const prLine = renderPullRequest(pr, config.pr_template || '- #{{TITLE}}');
                sections.push(prLine);
            }
            sections.push('');
        }
    }
    // Handle uncategorized PRs
    const uncategorized = categorized.get('__uncategorized__') || [];
    if (uncategorized.length > 0) {
        sections.push('## Other Changes');
        sections.push('');
        for (const pr of uncategorized) {
            const prLine = renderPullRequest(pr, config.pr_template || '- #{{TITLE}}');
            sections.push(prLine);
        }
        sections.push('');
    }
    // Build main changelog content
    let changelog = sections.join('\n').trim();
    // Apply template if provided
    if (config.template) {
        changelog = applyTemplate(config.template, changelog, pullRequests);
    }
    // Add postfix message if provided
    if (postfixMessage) {
        changelog += '\n\n' + postfixMessage;
    }
    return changelog;
}
/**
 * Categorize pull requests based on configuration
 */
function categorizePullRequests(prs, categories, ignoreLabels) {
    const categorized = new Map();
    const uncategorized = [];
    // Initialize category maps
    for (const category of categories) {
        categorized.set(category.title, []);
    }
    categorized.set('__uncategorized__', uncategorized);
    // Filter out ignored PRs
    const filteredPRs = prs.filter(pr => {
        return !pr.labels.some(label => ignoreLabels.includes(label.toLowerCase()));
    });
    // Categorize each PR
    for (const pr of filteredPRs) {
        let matched = false;
        for (const category of categories) {
            if (matchesCategory(pr, category)) {
                const categoryPRs = categorized.get(category.title) || [];
                categoryPRs.push(pr);
                categorized.set(category.title, categoryPRs);
                matched = true;
                break; // PR can only belong to one category
            }
        }
        if (!matched) {
            uncategorized.push(pr);
        }
    }
    return categorized;
}
/**
 * Check if a PR matches a category
 */
function matchesCategory(pr, category) {
    if (!category.labels || category.labels.length === 0) {
        return false;
    }
    const prLabels = pr.labels.map(l => l.toLowerCase());
    const categoryLabels = category.labels.map(l => l.toLowerCase());
    // Check if any label matches
    return categoryLabels.some(label => prLabels.includes(label));
}
/**
 * Render a pull request using template
 */
function renderPullRequest(pr, template) {
    let result = template;
    // Replace placeholders
    result = result.replace(/#\{\{NUMBER\}\}/g, String(pr.number));
    result = result.replace(/#\{\{TITLE\}\}/g, pr.title);
    result = result.replace(/#\{\{AUTHOR\}\}/g, pr.author);
    result = result.replace(/#\{\{URL\}\}/g, pr.htmlURL);
    result = result.replace(/#\{\{BRANCH\}\}/g, pr.branch || '');
    result = result.replace(/#\{\{BASE_BRANCH\}\}/g, pr.baseBranch);
    result = result.replace(/#\{\{MILESTONE\}\}/g, pr.milestone);
    result = result.replace(/#\{\{BODY\}\}/g, pr.body);
    result = result.replace(/#\{\{LABELS\}\}/g, pr.labels.join(', '));
    result = result.replace(/#\{\{MERGE_COMMIT_SHA\}\}/g, pr.mergeCommitSha);
    if (pr.mergedAt) {
        result = result.replace(/#\{\{MERGED_AT\}\}/g, pr.mergedAt.format('YYYY-MM-DD'));
    }
    return result;
}
/**
 * Apply main template with placeholders
 */
function applyTemplate(template, changelog, prs) {
    let result = template;
    // Replace main changelog placeholder
    result = result.replace(/#\{\{CHANGELOG\}\}/g, changelog);
    // Replace PR list placeholder
    const prList = prs.map(pr => `- #${pr.number}: ${pr.title}`).join('\n');
    result = result.replace(/#\{\{PR_LIST\}\}/g, prList);
    // Replace contributors placeholder
    const contributors = Array.from(new Set(prs.map(pr => pr.author))).join(', ');
    result = result.replace(/#\{\{CONTRIBUTORS\}\}/g, contributors);
    // Replace PR numbers placeholder
    const prNumbers = prs.map(pr => pr.number).join(', ');
    result = result.replace(/#\{\{PULL_REQUESTS\}\}/g, prNumbers);
    return result;
}
//# sourceMappingURL=changelog.js.map