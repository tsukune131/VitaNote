import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import {
  RICE_BOWL_KCAL,
  daysUntil,
  requiredDailyKcal,
  safeRequiredForDay,
  stepsToKcal,
  suggestedSteps,
  totalKcalToGoal,
} from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { prescriptionView, type PrescriptionView } from '../lib/prescription';
import { InfoButton } from './InfoButton';
import { SourcesLink } from './SourcesSheet';

const WINDOW_DAYS = 7;

const kcal = (n: number) => `${Math.round(n).toLocaleString()}kcal`;
const bowls = (n: number) => `${(n / RICE_BOWL_KCAL).toFixed(1)}杯分`;

/**
 * きょうの目標まで「あと何をすればいいか」を、歩数とご飯換算という具体的な行動に変換する。
 * 夕食が入る前は「あと何kcal食べられるか(予算)」、入った後は「達成/オーバー」を見せる。
 *
 * 本文は「〜できます」「〜が目安です」の直説法で書く。「〜してください」の命令形は
 * 使わない(個別の行動指示と読まれないため)。見出しから医療を思わせる語を外した分、
 * 本文の語調がこのカードの唯一の主張になる。
 */
export function TodayPrescription({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    () => getRecentDayStats(profile, WINDOW_DAYS),
    [profile.id, profile.heightCm, profile.sex, profile.birthDate],
  );

  if (!recent) return null;
  const { days } = recent;
  const today = days.at(-1);

  const latestWeight = days.filter((d) => d.weight != null).at(-1)?.weight;
  const required =
    profile.targetWeightKg != null && profile.targetDate && latestWeight != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestWeight, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  const showRequired = required != null && Number.isFinite(required) && required > 0;
  if (!showRequired) return null; // 目標未設定では「あと何」を計算できない

  // 目標をそのまま逆算すると食事量が極端に少ない指示になりうる。
  // 勧める量が「基礎代謝または1,200kcalの高い方」を割らないところで頭打ちにする。
  // 頭打ちできない(基礎代謝が推定できない)ときは逆算値を使わず、何を入れれば出るかだけ案内する。
  const safe = safeRequiredForDay(required, today?.bmr, today?.burn);
  const view: PrescriptionView =
    safe == null
      ? { kind: 'need-record' }
      : prescriptionView(today?.deficit, safe.value, today?.dinnerLogged ?? false);
  // 基礎代謝(=貯金)の推定に必要な任意項目が揃っているか
  const canEstimate = profile.heightCm != null && !!profile.birthDate && !!profile.sex;

  // 歩数換算(体重ベース)。1,000歩あたりの消費と、指定kcalを歩くのに必要な歩数。
  // 勧めてよい上限を超える量はundefinedになる。無理な歩数を指示しない(ガイドライン1.4.5)
  const kcalPer1000 = latestWeight != null ? Math.round(stepsToKcal(1000, latestWeight)) : undefined;
  const walk = (steps: number) => `約${steps.toLocaleString()}歩`;
  const overSteps =
    view.kind === 'budget-over' || view.kind === 'over'
      ? suggestedSteps(view.over, latestWeight)
      : undefined;

  return (
    <div className="card">
      {/* 旧称は「きょうの処方箋」。手帳になぞらえた呼び名だと見出しの下で断る必要があり、
          その弁解2行が紙面を占めていた。名前を結論(=目安)に寄せると弁解ごと要らなくなる */}
      <h2 className="head-line">
        きょうの目安
        <InfoButton about={['mets', 'rice', 'intakeFloor']} label="きょうの目安の計算式と出典" />
      </h2>

      {view.kind === 'need-record' && (
        <p className="muted" style={{ margin: 0 }}>
          {canEstimate
            ? '食事と体重を記録すると、きょう必要な散歩・食事量の目安が分かります。'
            : '目安の計算には、食事と体重の記録に加えて「あなた」タブの身長・生年月日・性別(任意)が必要です。'}
        </p>
      )}

      {view.kind === 'budget-ok' && (
        <>
          <p style={{ marginTop: 0 }}>
            きょうは <strong>あと {kcal(view.budget)}</strong> 食べられます(ご飯 約
            {bowls(view.budget)})。
          </p>
          {kcalPer1000 != null && (
            <p className="muted" style={{ margin: 0 }}>
              🚶 歩けばもう少し食べられます(1,000歩ごとに約{kcalPer1000}kcal)。
            </p>
          )}
        </>
      )}

      {view.kind === 'budget-over' && (
        <>
          <p style={{ marginTop: 0 }}>
            いまのままだと <strong>{kcal(view.over)} オーバー</strong>します。
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {overSteps != null
              ? `夕食を軽くするか、🚶 ${walk(overSteps)} 歩くと取り返せます(無理のない範囲で)。`
              : '歩数だけで取り返すのは難しい量です。夕食を軽くするか、数日かけて調整する方法もあります。'}
          </p>
        </>
      )}

      {view.kind === 'achieved' && (
        <p style={{ margin: 0 }}>きょうの目標を達成しました。よく頑張りましたね！</p>
      )}

      {view.kind === 'over' && (
        <>
          <p style={{ marginTop: 0 }}>
            きょうは <strong>{kcal(view.over)} オーバー</strong>でした。
          </p>
          <p className="muted" style={{ margin: 0 }}>
            夜に取り返すのは大変な量です。明日以降の活動で調整する方法もあります。
            <br />
            {overSteps != null
              ? `歩数では🚶 ${walk(overSteps)} に相当します(無理のない範囲で)。`
              : '歩数だけで取り返すのは難しい量なので、数日かけての調整が現実的です。'}
          </p>
        </>
      )}

      {/* 目標に無理があるときは黙って厳しい数字を出さず、頭打ちにしたことを伝える。
          理由と対処の全文は、対処できる唯一の画面である「あなた」タブの目標欄に置く */}
      {safe?.capped && today?.bmr != null && (
        <p className="muted note">
          ※この目標では達成日に届きません。上の数字は食事量の下限で止めています。
          「あなた」タブで目標を見直せます。
        </p>
      )}

      {/* 画面に出る「ご飯 約○杯分」「約○歩」の根拠。ガイドライン1.4.1が開示を求めるのは
          計算方法(METs法)だけでなく、使っている値(茶碗1杯のkcal)も含む */}
      <p className="source-link" style={{ marginBottom: 0 }}>
        {/* 換算値は定数から埋める。ここに数字を書くと定数を変えたときに食い違う */}
        歩数はMETs法、ご飯は茶碗1杯{RICE_BOWL_KCAL}kcalで換算した目安です。
        <SourcesLink focus={['mets', 'rice']} label="計算式と出典" />
      </p>
    </div>
  );
}
