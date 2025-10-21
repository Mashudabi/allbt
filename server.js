// server.js — simple Express backend using lowdb (JSON file) for storage
if(amount < 10 || amount > 500) return res.status(400).json({ error: 'invalid_amount' });
await db.read();
const round = db.data.rounds.find(r=>r.id===roundId);
if(!round) return res.status(404).json({ error: 'round_not_found' });
if(round.status !== 'running') return res.status(400).json({ error: 'round_not_running' });
const user = db.data.users[req.user.phone];
if(user.balance < amount) return res.status(400).json({ error: 'insufficient' });
// deduct balance to reserve
user.balance -= amount;
// store bet
round.bets[req.user.phone] = round.bets[req.user.phone] || [];
round.bets[req.user.phone].push({ id: nanoid(), amount, placedAt: Date.now(), cashed: false });
await db.write();
res.json({ ok:true, balance: user.balance });
});


// API: cashout (server verifies current multiplier and crash)
// For demo we'll accept a multiplier in the request and verify it's < crashAt
app.post('/api/rounds/:roundId/cash', authMiddleware, async (req, res) => {
const roundId = Number(req.params.roundId);
const multiplier = Number(req.body.multiplier || 0);
if(multiplier <= 0) return res.status(400).json({ error: 'invalid_multiplier' });
await db.read();
const round = db.data.rounds.find(r=>r.id===roundId);
if(!round) return res.status(404).json({ error: 'round_not_found' });
const user = db.data.users[req.user.phone];
const userBets = (round.bets[req.user.phone] || []).filter(b=>!b.cashed);
if(userBets.length === 0) return res.status(400).json({ error: 'no_active_bets' });


// check crash
if(multiplier >= round.crashAt){
// crash happened at or before this multiplier -> bets lost (already deducted)
userBets.forEach(b => b.cashed = true);
await db.write();
return res.json({ ok:true, result: 'lost', balance: user.balance });
}


// payout
let totalPayout = 0;
userBets.forEach(b => {
const payout = b.amount * multiplier;
totalPayout += payout;
b.cashed = true;
b.payout = payout;
});
user.balance += totalPayout;
await db.write();
return res.json({ ok:true, result: 'win', payout: totalPayout, balance: user.balance });
});


// Start server
initDB().then(()=>{
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server running on', PORT));
}).catch(err=>{ console.error('DB init error', err); process.exit(1); });