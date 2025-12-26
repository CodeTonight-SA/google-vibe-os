/**
 * Recurrence Manager for Googol Vibe
 * Handles RFC 5545 recurrence rules for tasks
 * Google Tasks API doesn't support recurrence natively - this is client-side
 */

const fs = require('fs');
const path = require('path');
const { RRule } = require('rrule');
const configManager = require('./config-manager');

class RecurrenceManager {
    constructor() {
        this.rules = [];
        this.filePath = null;
    }

    /**
     * Initialize the manager - must be called after app ready
     */
    init() {
        this.filePath = path.join(configManager.configDir, 'recurrence.json');
        this.load();
    }

    /**
     * Load recurrence rules from disk
     */
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf-8');
                const data = JSON.parse(content);
                this.rules = data.rules || [];
            } else {
                this.rules = [];
            }
        } catch (e) {
            console.error('[RecurrenceManager] Failed to load rules:', e);
            this.rules = [];
        }
    }

    /**
     * Save recurrence rules to disk
     */
    save() {
        try {
            const data = { rules: this.rules, updatedAt: new Date().toISOString() };
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[RecurrenceManager] Failed to save rules:', e);
        }
    }

    /**
     * Create a new recurrence rule
     * @param {Object} params - Rule parameters
     * @param {string} params.title - Task title
     * @param {string} params.notes - Task notes
     * @param {string} params.rruleString - RFC 5545 RRULE string
     * @param {string} params.taskListId - Google Tasks list ID
     * @returns {Object} Created rule
     */
    createRule({ title, notes, rruleString, taskListId }) {
        const rule = {
            id: this.generateId(),
            title,
            notes: notes || '',
            rrule: rruleString,
            taskListId,
            createdAt: new Date().toISOString(),
            lastGenerated: null,
            nextDue: this.calculateNextDue(rruleString)
        };

        this.rules.push(rule);
        this.save();
        return rule;
    }

    /**
     * Update an existing rule
     * @param {string} id - Rule ID
     * @param {Object} updates - Fields to update
     */
    updateRule(id, updates) {
        const index = this.rules.findIndex(r => r.id === id);
        if (index === -1) return null;

        // If rrule changed, recalculate next due
        if (updates.rrule && updates.rrule !== this.rules[index].rrule) {
            updates.nextDue = this.calculateNextDue(updates.rrule);
        }

        this.rules[index] = { ...this.rules[index], ...updates };
        this.save();
        return this.rules[index];
    }

    /**
     * Delete a recurrence rule
     * @param {string} id - Rule ID
     */
    deleteRule(id) {
        this.rules = this.rules.filter(r => r.id !== id);
        this.save();
    }

    /**
     * Get all rules
     */
    getAllRules() {
        return this.rules;
    }

    /**
     * Get rule by ID
     */
    getRule(id) {
        return this.rules.find(r => r.id === id);
    }

    /**
     * Get rules that are due for task generation
     * @returns {Array} Rules with nextDue <= now
     */
    getDueRules() {
        const now = new Date();
        return this.rules.filter(rule => {
            if (!rule.nextDue) return false;
            const nextDue = new Date(rule.nextDue);
            return nextDue <= now;
        });
    }

    /**
     * Mark a rule as generated and calculate next occurrence
     * @param {string} id - Rule ID
     */
    markGenerated(id) {
        const rule = this.getRule(id);
        if (!rule) return null;

        rule.lastGenerated = new Date().toISOString();
        rule.nextDue = this.calculateNextDue(rule.rrule, new Date());
        this.save();
        return rule;
    }

    /**
     * Calculate next due date from RRULE string
     * @param {string} rruleString - RFC 5545 RRULE string
     * @param {Date} after - Calculate next occurrence after this date
     * @returns {string|null} ISO date string or null
     */
    calculateNextDue(rruleString, after = new Date()) {
        try {
            const rule = RRule.fromString(rruleString);
            const next = rule.after(after, true); // inclusive
            return next ? next.toISOString() : null;
        } catch (e) {
            console.error('[RecurrenceManager] Invalid RRULE:', rruleString, e);
            return null;
        }
    }

    /**
     * Generate RRULE string from user-friendly options
     * @param {Object} options - Recurrence options
     * @param {string} options.frequency - 'daily' | 'weekly' | 'monthly' | 'yearly'
     * @param {number} options.interval - Every N periods
     * @param {number[]} options.weekdays - For weekly: [0-6] where 0=Monday
     * @param {number} options.monthday - For monthly: day of month (1-31)
     * @param {Date} options.startDate - Start date
     * @returns {string} RRULE string
     */
    buildRRule({ frequency, interval = 1, weekdays, monthday, startDate }) {
        const freqMap = {
            daily: RRule.DAILY,
            weekly: RRule.WEEKLY,
            monthly: RRule.MONTHLY,
            yearly: RRule.YEARLY
        };

        const options = {
            freq: freqMap[frequency] || RRule.DAILY,
            interval,
            dtstart: startDate || new Date()
        };

        // Weekly with specific days
        if (frequency === 'weekly' && weekdays && weekdays.length > 0) {
            const dayMap = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
            options.byweekday = weekdays.map(d => dayMap[d]);
        }

        // Monthly on specific day
        if (frequency === 'monthly' && monthday) {
            options.bymonthday = monthday;
        }

        const rule = new RRule(options);
        return rule.toString();
    }

    /**
     * Get human-readable description of RRULE
     * @param {string} rruleString - RFC 5545 RRULE string
     * @returns {string} Human-readable text
     */
    describe(rruleString) {
        try {
            const rule = RRule.fromString(rruleString);
            return rule.toText();
        } catch (e) {
            return 'Custom recurrence';
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Singleton instance
const recurrenceManager = new RecurrenceManager();

module.exports = recurrenceManager;
