import LegalPage, { Section } from '@/components/LegalPage'

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@karashop.ru'
const MANAGER = process.env.NEXT_PUBLIC_MANAGER || ''

export const metadata = { title: 'Возврат средств — KaraShop' }

export default function RefundsPage() {
  const supportLink = MANAGER
    ? <a href={`https://t.me/${MANAGER.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{MANAGER}</a>
    : <a href={`mailto:${EMAIL}`} className="text-green-400 hover:underline">{EMAIL}</a>

  return (
    <LegalPage title="Условия возврата средств">

      <Section title="Общие положения">
        <p>Настоящий раздел регулирует порядок, сроки и условия возврата денежных средств за услуги, приобретённые через сервис <strong className="text-white">KaraShop</strong>.</p>
        <p>KaraShop оказывает исключительно <strong className="text-white">цифровые услуги</strong> (бустинг игровых аккаунтов). В связи с этим возврат регулируется согласно правилам дистанционного оказания услуг.</p>
      </Section>

      <Section title="Условия возврата">
        <p><strong className="text-white">До начала выполнения заказа</strong> — полный возврат 100% оплаченной суммы по запросу клиента без дополнительных условий.</p>
        <p><strong className="text-white">После начала выполнения заказа</strong> — возврат не производится, так как специалист уже приступил к работе и его труд не может быть компенсирован.</p>
        <p><strong className="text-white">Если выполнение невозможно по вине сервиса</strong> (технические проблемы, отсутствие свободных специалистов и т.п.) — полный возврат 100% суммы.</p>
        <p><strong className="text-white">Если услуга выполнена ненадлежащим образом</strong> — частичный или полный возврат по результату рассмотрения обращения.</p>
      </Section>

      <Section title="Сроки подачи заявки на возврат">
        <p><strong className="text-white">До начала выполнения</strong> — заявку можно подать в любой момент после оплаты.</p>
        <p><strong className="text-white">По вине сервиса / ненадлежащее выполнение</strong> — заявку необходимо подать в течение <strong className="text-white">14 календарных дней</strong> с момента завершения заказа.</p>
        <p>Заявки, поданные за пределами указанных сроков, рассматриваются в индивидуальном порядке и могут быть отклонены.</p>
      </Section>

      <Section title="Сроки рассмотрения заявки">
        <p><strong className="text-white">1 рабочий день</strong> — подтверждение получения заявки на возврат.</p>
        <p><strong className="text-white">До 3 рабочих дней</strong> — рассмотрение заявки и принятие решения о возврате.</p>
        <p>В сложных случаях (оспариваемое качество, частичное выполнение) срок рассмотрения может быть продлён до <strong className="text-white">7 рабочих дней</strong> — в этом случае мы уведомим вас отдельно.</p>
      </Section>

      <Section title="Сроки проведения возврата">
        <p>После принятия положительного решения возврат осуществляется в следующие сроки:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong className="text-white">СБП</strong> — до 5 рабочих дней</li>
          <li><strong className="text-white">Карта РФ</strong> — до 10 рабочих дней</li>
          <li><strong className="text-white">Международная карта</strong> — до 30 календарных дней</li>
        </ul>
        <p className="mt-2">Средства возвращаются тем же способом, которым была произведена оплата. Изменение реквизитов для возврата не предусмотрено.</p>
      </Section>

      <Section title="Инструкция по оформлению возврата">
        <ol className="list-decimal list-inside space-y-3 mt-2">
          <li>
            <strong className="text-white">Свяжитесь с поддержкой</strong> — напишите нам в Telegram {supportLink} или на почту <a href={`mailto:${EMAIL}`} className="text-green-400 hover:underline">{EMAIL}</a>.
          </li>
          <li>
            <strong className="text-white">Укажите в обращении:</strong>
            <ul className="list-disc list-inside mt-1 ml-4 space-y-1 text-slate-400">
              <li>Номер заказа (например: #1234)</li>
              <li>Причину возврата</li>
              <li>Имя пользователя в Telegram или email, с которого совершалась оплата</li>
            </ul>
          </li>
          <li>
            <strong className="text-white">Дождитесь ответа</strong> — в течение 1 рабочего дня мы подтвердим получение заявки и сообщим о дальнейших шагах.
          </li>
          <li>
            <strong className="text-white">Получите решение</strong> — в течение 3 рабочих дней мы уведомим вас о результате рассмотрения.
          </li>
          <li>
            <strong className="text-white">Получите средства</strong> — при положительном решении возврат будет произведён в сроки, указанные выше, на исходный способ оплаты.
          </li>
        </ol>
      </Section>

      <Section title="Контакты для возврата">
        <p>Поддержка (Telegram): {supportLink}</p>
        <p>Электронная почта: <a href={`mailto:${EMAIL}`} className="text-green-400 hover:underline">{EMAIL}</a></p>
        <p className="text-slate-500 text-sm mt-2">Время ответа поддержки: с 10:00 до 22:00 МСК, без выходных.</p>
      </Section>

    </LegalPage>
  )
}
