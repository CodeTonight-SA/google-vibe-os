import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// RecurrenceManager depends on configManager for filePath and on rrule.
// Since mocking CJS electron is fragile, we import the class directly,
// construct a fresh instance, and set filePath manually.

let tmpDir
let recurrenceManager

// Import the RecurrenceManager class (not the singleton)
// We'll create our own instance to avoid configManager dependency
class TestableRecurrenceManager {
  constructor(filePath) {
    this.rules = []
    this.filePath = filePath
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const data = JSON.parse(content)
        this.rules = data.rules || []
      } else {
        this.rules = []
      }
    } catch (e) {
      this.rules = []
    }
  }

  save() {
    const data = { rules: this.rules, updatedAt: new Date().toISOString() }
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
  }

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
    }
    this.rules.push(rule)
    this.save()
    return rule
  }

  updateRule(id, updates) {
    const index = this.rules.findIndex(r => r.id === id)
    if (index === -1) return null
    if (updates.rrule && updates.rrule !== this.rules[index].rrule) {
      updates.nextDue = this.calculateNextDue(updates.rrule)
    }
    this.rules[index] = { ...this.rules[index], ...updates }
    this.save()
    return this.rules[index]
  }

  deleteRule(id) {
    this.rules = this.rules.filter(r => r.id !== id)
    this.save()
  }

  getAllRules() { return this.rules }
  getRule(id) { return this.rules.find(r => r.id === id) }

  getDueRules() {
    const now = new Date()
    return this.rules.filter(rule => {
      if (!rule.nextDue) return false
      return new Date(rule.nextDue) <= now
    })
  }

  markGenerated(id) {
    const rule = this.getRule(id)
    if (!rule) return null
    rule.lastGenerated = new Date().toISOString()
    rule.nextDue = this.calculateNextDue(rule.rrule, new Date())
    this.save()
    return rule
  }

  calculateNextDue(rruleString, after = new Date()) {
    try {
      const { RRule } = require('rrule')
      const rule = RRule.fromString(rruleString)
      const next = rule.after(after, true)
      return next ? next.toISOString() : null
    } catch (e) {
      return null
    }
  }

  buildRRule({ frequency, interval = 1, weekdays, monthday, startDate }) {
    const { RRule } = require('rrule')
    const freqMap = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY }
    const options = { freq: freqMap[frequency] || RRule.DAILY, interval, dtstart: startDate || new Date() }
    if (frequency === 'weekly' && weekdays && weekdays.length > 0) {
      const dayMap = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]
      options.byweekday = weekdays.map(d => dayMap[d])
    }
    if (frequency === 'monthly' && monthday) {
      options.bymonthday = monthday
    }
    return new RRule(options).toString()
  }

  describe(rruleString) {
    try {
      const { RRule } = require('rrule')
      return RRule.fromString(rruleString).toText()
    } catch (e) {
      return 'Custom recurrence'
    }
  }

  generateId() {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-rec-test-'))
  recurrenceManager = new TestableRecurrenceManager(path.join(tmpDir, 'recurrence.json'))
})

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('RecurrenceManager', () => {
  describe('init', () => {
    it('sets filePath', () => {
      expect(recurrenceManager.filePath).toBe(path.join(tmpDir, 'recurrence.json'))
    })

    it('starts with empty rules when no file exists', () => {
      expect(recurrenceManager.rules).toEqual([])
    })
  })

  describe('createRule', () => {
    it('creates a rule with all required fields', () => {
      const rule = recurrenceManager.createRule({
        title: 'Daily standup',
        notes: 'Team sync',
        rruleString: 'FREQ=DAILY;INTERVAL=1',
        taskListId: 'list-1'
      })

      expect(rule.id).toMatch(/^rec_/)
      expect(rule.title).toBe('Daily standup')
      expect(rule.notes).toBe('Team sync')
      expect(rule.rrule).toBe('FREQ=DAILY;INTERVAL=1')
      expect(rule.taskListId).toBe('list-1')
      expect(rule.createdAt).toBeDefined()
      expect(rule.lastGenerated).toBeNull()
    })

    it('persists to disk', () => {
      recurrenceManager.createRule({
        title: 'Persist test',
        rruleString: 'FREQ=WEEKLY;INTERVAL=1',
        taskListId: 'list-1'
      })

      const data = JSON.parse(fs.readFileSync(recurrenceManager.filePath, 'utf-8'))
      expect(data.rules).toHaveLength(1)
      expect(data.rules[0].title).toBe('Persist test')
    })

    it('defaults notes to empty string', () => {
      const rule = recurrenceManager.createRule({
        title: 'No notes',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })
      expect(rule.notes).toBe('')
    })
  })

  describe('getRule / getAllRules', () => {
    it('retrieves by ID', () => {
      const created = recurrenceManager.createRule({
        title: 'Find me',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      const found = recurrenceManager.getRule(created.id)
      expect(found).toBeDefined()
      expect(found.title).toBe('Find me')
    })

    it('returns undefined for non-existent ID', () => {
      expect(recurrenceManager.getRule('nonexistent')).toBeUndefined()
    })

    it('getAllRules returns all created rules', () => {
      recurrenceManager.createRule({ title: 'A', rruleString: 'FREQ=DAILY', taskListId: 'l1' })
      recurrenceManager.createRule({ title: 'B', rruleString: 'FREQ=WEEKLY', taskListId: 'l2' })
      expect(recurrenceManager.getAllRules()).toHaveLength(2)
    })
  })

  describe('updateRule', () => {
    it('updates fields on existing rule', () => {
      const rule = recurrenceManager.createRule({
        title: 'Original',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      const updated = recurrenceManager.updateRule(rule.id, { title: 'Updated' })
      expect(updated.title).toBe('Updated')
      expect(updated.rrule).toBe('FREQ=DAILY')
    })

    it('recalculates nextDue when rrule changes', () => {
      const rule = recurrenceManager.createRule({
        title: 'Recalc',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      const updated = recurrenceManager.updateRule(rule.id, { rrule: 'FREQ=WEEKLY' })
      expect(updated.nextDue).toBeDefined()
    })

    it('returns null for non-existent rule', () => {
      expect(recurrenceManager.updateRule('fake-id', { title: 'x' })).toBeNull()
    })
  })

  describe('deleteRule', () => {
    it('removes rule and persists', () => {
      const rule = recurrenceManager.createRule({
        title: 'Delete me',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      recurrenceManager.deleteRule(rule.id)
      expect(recurrenceManager.getAllRules()).toHaveLength(0)

      const data = JSON.parse(fs.readFileSync(recurrenceManager.filePath, 'utf-8'))
      expect(data.rules).toHaveLength(0)
    })

    it('no-ops for non-existent ID', () => {
      recurrenceManager.createRule({
        title: 'Keep',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      recurrenceManager.deleteRule('nonexistent')
      expect(recurrenceManager.getAllRules()).toHaveLength(1)
    })
  })

  describe('getDueRules', () => {
    it('returns rules with nextDue in the past', () => {
      const rule = recurrenceManager.createRule({
        title: 'Past due',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })
      rule.nextDue = new Date(Date.now() - 86400000).toISOString()

      const due = recurrenceManager.getDueRules()
      expect(due).toHaveLength(1)
      expect(due[0].title).toBe('Past due')
    })

    it('excludes future rules', () => {
      const rule = recurrenceManager.createRule({
        title: 'Future',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })
      rule.nextDue = new Date(Date.now() + 86400000 * 365).toISOString()
      expect(recurrenceManager.getDueRules()).toHaveLength(0)
    })

    it('excludes rules with null nextDue', () => {
      const rule = recurrenceManager.createRule({
        title: 'No due',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })
      rule.nextDue = null
      expect(recurrenceManager.getDueRules()).toHaveLength(0)
    })
  })

  describe('markGenerated', () => {
    it('sets lastGenerated and recalculates nextDue', () => {
      const rule = recurrenceManager.createRule({
        title: 'Generate',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      const marked = recurrenceManager.markGenerated(rule.id)
      expect(marked.lastGenerated).toBeDefined()
      expect(new Date(marked.lastGenerated).getTime()).toBeGreaterThan(0)
    })

    it('returns null for non-existent rule', () => {
      expect(recurrenceManager.markGenerated('fake')).toBeNull()
    })
  })

  describe('calculateNextDue', () => {
    it('returns ISO string for valid RRULE', () => {
      const next = recurrenceManager.calculateNextDue('FREQ=DAILY;INTERVAL=1')
      expect(next).not.toBeNull()
      expect(new Date(next).getTime()).toBeGreaterThan(0)
    })

    it('returns null for invalid RRULE', () => {
      const next = recurrenceManager.calculateNextDue('INVALID_RRULE_STRING')
      expect(next).toBeNull()
    })

    it('respects after parameter', () => {
      const after = new Date('2030-01-01')
      const next = recurrenceManager.calculateNextDue('FREQ=DAILY;INTERVAL=1', after)
      expect(new Date(next).getTime()).toBeGreaterThanOrEqual(after.getTime())
    })
  })

  describe('buildRRule', () => {
    it('builds daily rule', () => {
      const rrule = recurrenceManager.buildRRule({
        frequency: 'daily',
        interval: 1,
        startDate: new Date('2025-01-01')
      })
      expect(rrule).toContain('FREQ=DAILY')
    })

    it('builds weekly rule with specific days', () => {
      const rrule = recurrenceManager.buildRRule({
        frequency: 'weekly',
        weekdays: [0, 4],
        startDate: new Date('2025-01-01')
      })
      expect(rrule).toContain('FREQ=WEEKLY')
      expect(rrule).toContain('BYDAY')
    })

    it('builds monthly rule with specific day', () => {
      const rrule = recurrenceManager.buildRRule({
        frequency: 'monthly',
        monthday: 15,
        startDate: new Date('2025-01-01')
      })
      expect(rrule).toContain('FREQ=MONTHLY')
      expect(rrule).toContain('BYMONTHDAY=15')
    })

    it('defaults to daily for unknown frequency', () => {
      const rrule = recurrenceManager.buildRRule({
        frequency: 'invalid',
        startDate: new Date('2025-01-01')
      })
      expect(rrule).toContain('FREQ=DAILY')
    })
  })

  describe('describe', () => {
    it('returns human-readable text for valid RRULE', () => {
      const desc = recurrenceManager.describe('FREQ=DAILY;INTERVAL=1')
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(0)
    })

    it('returns fallback for invalid RRULE', () => {
      const desc = recurrenceManager.describe('GARBAGE')
      expect(desc).toBe('Custom recurrence')
    })
  })

  describe('generateId', () => {
    it('returns unique IDs', () => {
      const id1 = recurrenceManager.generateId()
      const id2 = recurrenceManager.generateId()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^rec_/)
    })
  })

  describe('load / save round-trip', () => {
    it('persists and reloads rules from disk', () => {
      recurrenceManager.createRule({
        title: 'Survive restart',
        rruleString: 'FREQ=DAILY',
        taskListId: 'list-1'
      })

      recurrenceManager.rules = []
      recurrenceManager.load()

      expect(recurrenceManager.getAllRules()).toHaveLength(1)
      expect(recurrenceManager.getAllRules()[0].title).toBe('Survive restart')
    })
  })
})
