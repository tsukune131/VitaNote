import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import {
  RICE_BOWL_KCAL,
  daysUntil,
  minIntakeKcal,
  requiredDailyKcal,
  safeRequiredForDay,
  stepsToKcal,
  suggestedSteps,
  totalKcalToGoal,
} from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { prescriptionView, type PrescriptionView } from '../lib/prescription';
import { SourcesLink } from './SourcesSheet';

const WINDOW_DAYS = 7;

const kcal = (n: number) => `${Math.round(n).toLocaleString()}kcal`;
const bowls = (n: number) => `${(n / RICE_BOWL_KCAL).toFixed(1)}杯分`;

/**
 * きょうの目標まで「あと何をすればいいか」を、歩数とご飯換算という具体的な行動に変換する。
 * 夕食が入る前は「あと何kcal食べられるか(予算)」、入った後は「達成/オーバー」を見せる。
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
      <h2>きょうの処方箋</h2>
      {/* 「処方箋」は手帳になぞらえた呼び名。規約でしか説明していないと
          医師の処方と読まれかねないので、見出しのすぐ下でも断っておく */}
      <p className="muted note" style={{ marginTop: 0 }}>
        ※「処方箋」は手帳になぞらえた呼び名です。医師の処方や治療の指示ではなく、
        あなたが設定した目標から機械的に逆算した、その日の目安です。
      </p>

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
              ? `夕食を軽くするか、🚶 ${walk(overSteps)} 歩くと取り返せます。`
              : '歩数だけで取り返すのは難しい量です。夕食を軽くするか、数日かけて調整しましょう。'}
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
            夜に取り返すのは大変なので、明日の活動で調整しましょう。
            <br />
            {overSteps != null
              ? `歩数では🚶 ${walk(overSteps)} が目安です。無理のない範囲で体を動かしましょう。`
              : '歩数だけで取り返すのは難しい量なので、数日かけて調整しましょう。'}
          </p>
        </>
      )}

      {/* 目標に無理があるときは黙って厳しい数字を出さず、頭打ちにしたことを伝える */}
      {safe?.capped && today?.bmr != null && (
        <p className="muted note">
          ※この目標を達成日までに実現しようとすると、1日の食事量が
          {Math.round(minIntakeKcal(today.bmr)).toLocaleString()}kcalを下回ってしまいます。
          上の目安は、食事量がそこを下回らないところで止めています。
          達成日を延ばすか目標体重を見直すことをおすすめします。
          減量の進め方は医師にご相談ください。
        </p>
      )}

      {/* 歩数・ご飯への換算はどれも推定式。数字を見せた場所から出典に行けるようにする */}
      <p className="source-link" style={{ marginBottom: 0 }}>
        歩数への換算はMETs法、ご飯の杯数は茶碗1杯240kcalとした推定です。体調や持病に応じて、
        無理のない範囲で。判断に迷うときは医師にご相談ください。
        <SourcesLink focus="mets" label="出典を見る" />
      </p>
    </div>
  );
}
