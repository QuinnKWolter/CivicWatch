export const legislatorData = {
  radar: {
    labels: ['Voting Attendance', 'Bill Sponsorship', 'Committee Activity', 
             'Bipartisan Cooperation', 'Constituent Engagement'],
    values: [85, 70, 90, 65, 80]
  }
}

export const networkData = {
  nodes: [
    { 
      id: "L1", 
      party: "D", 
      state: "CA", 
      name: "Alexandria Smith",
      committees: ["Judiciary", "Finance"],
      avgCivility: 0.85
    },
    { id: "L2", party: "R", state: "TX", name: "Robert Johnson", committees: ["Energy", "Finance"], civility: 72 },
    { id: "L3", party: "D", state: "NY", name: "Maria Williams", committees: ["Education", "Healthcare"], civility: 91 },
    { id: "L4", party: "R", state: "FL", name: "James Brown", committees: ["Defense", "Intelligence"], civility: 68 },
    { id: "L5", party: "D", state: "CA", name: "David Jones", committees: ["Environment", "Technology"], civility: 88 },
    { id: "L6", party: "R", state: "OH", name: "Sarah Miller", committees: ["Budget", "Infrastructure"], civility: 79 }
  ],
  links: [
    { 
      source: "L1", 
      target: "L2",
      sourceToTarget: {
        mentions: {
          count: 15,
          avgCivility: 0.78,
          misinformationCount: 2
        },
        replies: {
          count: 8,
          avgCivility: 0.92,
          misinformationCount: 0
        },
        retweets: {
          count: 12,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        total: 35,
        avgCivility: 0.83,
        misinformationCount: 3
      },
      targetToSource: {
        mentions: {
          count: 10,
          avgCivility: 0.78,
          misinformationCount: 2
        },
        replies: {
          count: 5,
          avgCivility: 0.92,
          misinformationCount: 0
        },
        retweets: {
          count: 8,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        total: 23,
        avgCivility: 0.83,
        misinformationCount: 3
      }
    },
    { 
      source: "L1", 
      target: "L3",
      sourceToTarget: {
        mentions: {
          count: 22,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 14,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 18,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 54,
        avgCivility: 0.85,
        misinformationCount: 1
      },
      targetToSource: {
        mentions: {
          count: 18,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 12,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 15,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 45,
        avgCivility: 0.85,
        misinformationCount: 1
      }
    },
    { 
      source: "L2", 
      target: "L4",
      sourceToTarget: {
        mentions: {
          count: 18,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 9,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 15,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 42,
        avgCivility: 0.85,
        misinformationCount: 1
      },
      targetToSource: {
        mentions: {
          count: 14,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 8,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 12,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 34,
        avgCivility: 0.85,
        misinformationCount: 1
      }
    },
    { 
      source: "L3", 
      target: "L5",
      sourceToTarget: {
        mentions: {
          count: 25,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 16,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 20,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 61,
        avgCivility: 0.85,
        misinformationCount: 1
      },
      targetToSource: {
        mentions: {
          count: 20,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 13,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 16,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 49,
        avgCivility: 0.85,
        misinformationCount: 1
      }
    },
    { 
      source: "L4", 
      target: "L5",
      sourceToTarget: {
        mentions: {
          count: 12,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        replies: {
          count: 7,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 9,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 28,
        avgCivility: 0.85,
        misinformationCount: 0
      },
      targetToSource: {
        mentions: {
          count: 10,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        replies: {
          count: 6,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 8,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 24,
        avgCivility: 0.85,
        misinformationCount: 0
      }
    },
    { 
      source: "L6", 
      target: "L1",
      sourceToTarget: {
        mentions: {
          count: 16,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 11,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 13,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 40,
        avgCivility: 0.85,
        misinformationCount: 1
      },
      targetToSource: {
        mentions: {
          count: 13,
          avgCivility: 0.85,
          misinformationCount: 1
        },
        replies: {
          count: 9,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        retweets: {
          count: 10,
          avgCivility: 0.85,
          misinformationCount: 0
        },
        total: 32,
        avgCivility: 0.85,
        misinformationCount: 1
      }
    }
  ]
}