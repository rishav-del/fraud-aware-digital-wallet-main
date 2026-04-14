"""
train_model.py - Fraud Detection ML Model (v4 - Real-World Anomaly Detection)
150,000 samples, 15 features, 7 attack patterns, Gradient Boosting
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import pickle, os, warnings
warnings.filterwarnings('ignore')
np.random.seed(42)

FEATURES = [
    'amount','sender_txn_count_1h','sender_txn_count_24h','sender_avg_amount',
    'amount_deviation','is_new_receiver','hour_of_day','is_night_transaction',
    'device_is_trusted','sender_account_age_days','amount_to_avg_ratio',
    'txn_velocity_score','receiver_risk_score','amount_round_flag',
    'time_since_last_txn_minutes'
]

N_LEGIT = 120000; N_FRAUD = 30000
print("="*60)
print("FRAUD DETECTION MODEL v4 — Training Pipeline")
print("="*60)
print(f"\nGenerating {N_LEGIT+N_FRAUD:,} training samples...")

def gen_legit(n):
    d = pd.DataFrame()
    tier = np.random.choice(['student','working','business'], n, p=[0.3,0.5,0.2])
    amounts = np.zeros(n)
    amounts[tier=='student'] = np.random.lognormal(5.5,0.8,(tier=='student').sum()).clip(10,5000)
    amounts[tier=='working'] = np.random.lognormal(6.8,1.0,(tier=='working').sum()).clip(50,30000)
    amounts[tier=='business'] = np.random.lognormal(8.0,1.2,(tier=='business').sum()).clip(500,100000)
    d['amount'] = amounts
    d['sender_txn_count_1h'] = np.random.choice([0]*40+[1]*30+[2]*20+[3]*10, n)
    d['sender_txn_count_24h'] = (d['sender_txn_count_1h']*np.random.uniform(2,6,n)+np.random.poisson(2,n)).astype(int).clip(0,20)
    d['sender_avg_amount'] = d['amount']*np.random.uniform(0.5,1.8,n)
    d['amount_deviation'] = np.random.normal(0,1.0,n)
    d['is_new_receiver'] = np.random.binomial(1,0.20,n)
    hrs = np.array([2,4,6,8,9,9,9,8,7,6,5,4,4,3,2,1,1,1], dtype=float)
    d['hour_of_day'] = np.random.choice(list(range(6,24)), n, p=hrs/hrs.sum())
    d['is_night_transaction'] = ((d['hour_of_day']>=23)|(d['hour_of_day']<=4)).astype(int)
    d['device_is_trusted'] = np.random.binomial(1,0.93,n)
    d['sender_account_age_days'] = np.random.gamma(5,50,n).clip(10,1000).astype(int)
    d['amount_to_avg_ratio'] = (d['amount']/(d['sender_avg_amount']+1)).clip(0,20)
    d['txn_velocity_score'] = (d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5).clip(0,50)
    d['receiver_risk_score'] = d['is_new_receiver']*np.random.uniform(0,0.3,n)
    d['amount_round_flag'] = ((d['amount']%1000==0)&(d['amount']>=5000)).astype(int)*np.random.binomial(1,0.3,n)
    d['time_since_last_txn_minutes'] = np.random.exponential(120,n).clip(5,1440)
    d['is_fraud'] = 0
    return d

def gen_fraud(n):
    per = n//7; rem = n-6*per; frames = []
    # P1: Account Takeover
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.lognormal(10.2,0.6,sz).clip(15000,500000)
    d['sender_txn_count_1h']=np.random.choice([1,2,3,4],sz)
    d['sender_txn_count_24h']=np.random.poisson(5,sz).clip(1,15)
    d['sender_avg_amount']=np.random.lognormal(6.5,0.8,sz)
    d['amount_deviation']=((d['amount']-d['sender_avg_amount'])/(d['sender_avg_amount']*0.3+1)).clip(0,30)
    d['is_new_receiver']=np.random.binomial(1,0.80,sz)
    d['hour_of_day']=np.random.choice([0,1,2,3,4,5,22,23],sz)
    d['is_night_transaction']=1
    d['device_is_trusted']=np.random.binomial(1,0.15,sz)
    d['sender_account_age_days']=np.random.gamma(4,50,sz).clip(30,800).astype(int)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(1,50)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.6,1.0,sz)
    d['amount_round_flag']=np.random.binomial(1,0.6,sz)
    d['time_since_last_txn_minutes']=np.random.uniform(0.5,10,sz)
    frames.append(d)
    # P2: Card Testing
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.choice([1,2,5,10,50,100],sz).astype(float)
    d['sender_txn_count_1h']=np.random.choice([8,10,12,15,20],sz)
    d['sender_txn_count_24h']=d['sender_txn_count_1h']*np.random.choice([2,3,4],sz)
    d['sender_avg_amount']=np.random.lognormal(6.0,1.0,sz)
    d['amount_deviation']=np.random.normal(-2,1,sz)
    d['is_new_receiver']=np.random.binomial(1,0.70,sz)
    d['hour_of_day']=np.random.choice(range(24),sz)
    d['is_night_transaction']=((d['hour_of_day']>=23)|(d['hour_of_day']<=4)).astype(int)
    d['device_is_trusted']=np.random.binomial(1,0.30,sz)
    d['sender_account_age_days']=np.random.gamma(3,40,sz).clip(1,500).astype(int)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(0,1)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.3,0.8,sz)
    d['amount_round_flag']=0
    d['time_since_last_txn_minutes']=np.random.uniform(0.1,2,sz)
    frames.append(d)
    # P3: Velocity Attack
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.lognormal(7.5,0.6,sz).clip(500,20000)
    d['sender_txn_count_1h']=np.random.choice([6,7,8,9,10,12],sz)
    d['sender_txn_count_24h']=d['sender_txn_count_1h']*np.random.choice([3,4,5],sz)
    d['sender_avg_amount']=d['amount']*np.random.uniform(0.3,1.0,sz)
    d['amount_deviation']=np.random.normal(2.0,1.5,sz)
    d['is_new_receiver']=np.random.binomial(1,0.50,sz)
    d['hour_of_day']=np.random.choice(range(24),sz)
    d['is_night_transaction']=((d['hour_of_day']>=23)|(d['hour_of_day']<=4)).astype(int)
    d['device_is_trusted']=np.random.binomial(1,0.45,sz)
    d['sender_account_age_days']=np.random.gamma(3,50,sz).clip(5,600).astype(int)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(0,15)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.3,0.7,sz)
    d['amount_round_flag']=np.random.binomial(1,0.4,sz)
    d['time_since_last_txn_minutes']=np.random.uniform(0.5,5,sz)
    frames.append(d)
    # P4: Smurfing
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.choice([4900,4950,4999,9900,9950,9999],sz).astype(float)
    d['sender_txn_count_1h']=np.random.choice([3,4,5,6],sz)
    d['sender_txn_count_24h']=np.random.choice([12,15,18,20,25],sz)
    d['sender_avg_amount']=np.random.lognormal(6.0,0.8,sz)
    d['amount_deviation']=np.random.normal(2.0,1.0,sz)
    d['is_new_receiver']=np.random.binomial(1,0.60,sz)
    d['hour_of_day']=np.random.choice(range(8,22),sz)
    d['is_night_transaction']=0
    d['device_is_trusted']=np.random.binomial(1,0.50,sz)
    d['sender_account_age_days']=np.random.randint(10,200,sz)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(0,15)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.4,0.8,sz)
    d['amount_round_flag']=0
    d['time_since_last_txn_minutes']=np.random.uniform(5,30,sz)
    frames.append(d)
    # P5: Social Engineering
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.lognormal(9.5,0.8,sz).clip(10000,200000)
    d['sender_txn_count_1h']=np.random.choice([0,1],sz)
    d['sender_txn_count_24h']=np.random.poisson(3,sz).clip(0,8)
    d['sender_avg_amount']=np.random.lognormal(6.5,1.0,sz)
    d['amount_deviation']=((d['amount']-d['sender_avg_amount'])/(d['sender_avg_amount']*0.3+1)).clip(0,25)
    d['is_new_receiver']=1
    d['hour_of_day']=np.random.choice(range(9,21),sz)
    d['is_night_transaction']=0
    d['device_is_trusted']=np.random.binomial(1,0.80,sz)
    d['sender_account_age_days']=np.random.gamma(4,60,sz).clip(30,800).astype(int)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(1,50)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.7,1.0,sz)
    d['amount_round_flag']=np.random.binomial(1,0.7,sz)
    d['time_since_last_txn_minutes']=np.random.exponential(60,sz).clip(5,500)
    frames.append(d)
    # P6: New Account Fraud
    d=pd.DataFrame(); sz=per
    d['amount']=np.random.lognormal(8.5,1.0,sz).clip(2000,150000)
    d['sender_txn_count_1h']=np.random.poisson(3,sz).clip(1,10)
    d['sender_txn_count_24h']=np.random.poisson(6,sz).clip(2,20)
    d['sender_avg_amount']=np.random.lognormal(6.0,0.5,sz)
    d['amount_deviation']=np.random.normal(4.0,2.0,sz)
    d['is_new_receiver']=np.random.binomial(1,0.75,sz)
    d['hour_of_day']=np.random.choice(range(24),sz)
    d['is_night_transaction']=((d['hour_of_day']>=23)|(d['hour_of_day']<=4)).astype(int)
    d['device_is_trusted']=np.random.binomial(1,0.20,sz)
    d['sender_account_age_days']=np.random.randint(0,5,sz)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(0,30)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.5,1.0,sz)
    d['amount_round_flag']=np.random.binomial(1,0.5,sz)
    d['time_since_last_txn_minutes']=np.random.uniform(1,15,sz)
    frames.append(d)
    # P7: Sleeper Fraud
    d=pd.DataFrame(); sz=rem
    d['amount']=np.random.lognormal(9.8,0.7,sz).clip(20000,400000)
    d['sender_txn_count_1h']=np.random.choice([0,1],sz)
    d['sender_txn_count_24h']=np.random.poisson(2,sz).clip(0,6)
    d['sender_avg_amount']=np.random.lognormal(6.0,0.6,sz)
    d['amount_deviation']=((d['amount']-d['sender_avg_amount'])/(d['sender_avg_amount']*0.3+1)).clip(2,40)
    d['is_new_receiver']=np.random.binomial(1,0.85,sz)
    d['hour_of_day']=np.random.choice([0,1,2,3,22,23],sz)
    d['is_night_transaction']=1
    d['device_is_trusted']=np.random.binomial(1,0.35,sz)
    d['sender_account_age_days']=np.random.randint(90,500,sz)
    d['amount_to_avg_ratio']=(d['amount']/(d['sender_avg_amount']+1)).clip(3,60)
    d['txn_velocity_score']=(d['sender_txn_count_1h']*3+d['sender_txn_count_24h']*0.5)
    d['receiver_risk_score']=np.random.uniform(0.6,1.0,sz)
    d['amount_round_flag']=np.random.binomial(1,0.5,sz)
    d['time_since_last_txn_minutes']=np.random.exponential(200,sz).clip(30,1000)
    frames.append(d)
    data=pd.concat(frames,ignore_index=True); data['is_fraud']=1; return data

df = pd.concat([gen_legit(N_LEGIT), gen_fraud(N_FRAUD)], ignore_index=True).sample(frac=1,random_state=42).reset_index(drop=True)
print(f"  Total: {len(df):,} samples\n")

X=df[FEATURES]; y=df['is_fraud']
X_train,X_test,y_train,y_test = train_test_split(X,y,test_size=0.2,random_state=42,stratify=y)

print("Training: 300 trees, depth 7, learning rate 0.08")
model = GradientBoostingClassifier(n_estimators=300,max_depth=7,learning_rate=0.08,
    min_samples_split=25,min_samples_leaf=15,subsample=0.8,max_features='sqrt',random_state=42)
model.fit(X_train,y_train)
print("  Done!\n")

y_pred=model.predict(X_test); y_proba=model.predict_proba(X_test)[:,1]*100
print("="*60); print("EVALUATION"); print("="*60)
print(classification_report(y_test,y_pred,target_names=['Legitimate','Fraud']))
cm=confusion_matrix(y_test,y_pred)
print(f"Confusion: TN={cm[0][0]:,} FP={cm[0][1]:,} FN={cm[1][0]:,} TP={cm[1][1]:,}")
ls=y_proba[y_test==0]; fs=y_proba[y_test==1]
print(f"\nScores - Legit: mean={ls.mean():.1f}% max={np.percentile(ls,95):.1f}%")
print(f"Scores - Fraud: mean={fs.mean():.1f}% min={np.percentile(fs,5):.1f}%")

print("\n"+"="*60); print("DYNAMIC SCORING DEMO"); print("="*60)
scenarios = [
    ("Rs500, known receiver, daytime, old account", [500,0,1,600,-0.2,0,14,0,1,365,0.8,0.5,0.1,0,120]),
    ("Rs500, 5th txn this hour (getting suspicious)", [500,5,10,600,-0.2,0,14,0,1,365,0.8,20,0.1,0,3]),
    ("Rs500, 10th txn this hour (BURST ATTACK)", [500,10,20,600,-0.2,0,14,0,1,365,0.8,40,0.1,0,1]),
    ("Rs5000, NEW person, daytime", [5000,0,2,1000,1.5,1,14,0,1,200,5.0,1,0.5,1,60]),
    ("Rs5000, NEW person, 2AM, UNTRUSTED device", [5000,0,2,1000,1.5,1,2,1,0,200,5.0,1,0.8,1,60]),
    ("Rs50000, known person, daytime, old account", [50000,0,1,45000,0.3,0,14,0,1,500,1.1,0.5,0.1,1,240]),
    ("Rs50000, NEW person, 3AM, NEW account, untrusted", [50000,2,5,1000,15.0,1,3,1,0,3,50.0,8.5,0.9,1,5]),
    ("Rs100 x15 rapid (card testing)", [100,15,30,500,-1.5,1,10,0,0,100,0.2,60,0.6,0,0.5]),
]
for label,feats in scenarios:
    s=model.predict_proba(np.array([feats]))[0][1]*100
    r='CRITICAL' if s>=80 else 'HIGH' if s>=60 else 'MEDIUM' if s>=35 else 'LOW'
    print(f"\n  {label}\n    -> Score: {s:.1f}%  [{r}]")

imp=pd.Series(model.feature_importances_,index=FEATURES).sort_values(ascending=False)
print("\n"+"="*60); print("FEATURE IMPORTANCE"); print("="*60)
for f,v in imp.items(): print(f"  {f:35s} {v:.4f} {'█'*int(v*80)}")

os.makedirs('model',exist_ok=True)
with open('model/fraud_model.pkl','wb') as f: pickle.dump({'model':model,'features':FEATURES},f)
print(f"\n✅ Model saved (15 features, 300 trees, {len(X_train):,} training samples)")
