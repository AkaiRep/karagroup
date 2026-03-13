import LegalPage, { Section } from '@/components/LegalPage'

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@karashop.ru'
const PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE || 'не указан'
const ADDRESS = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || 'не указан'
const INN = process.env.NEXT_PUBLIC_INN || ''
const MANAGER = process.env.NEXT_PUBLIC_MANAGER || ''
const CHANNEL = process.env.NEXT_PUBLIC_BOT_CHANNEL || ''

export const metadata = { title: 'Правовая информация — KaraShop' }

export default function LegalInfoPage() {
  return (
    <LegalPage title="Правовая информация">

      <Section title="Контактная информация">
        <p>Сервис: <strong className="text-white">KaraShop</strong></p>
        {INN && <p>ИНН: <strong className="text-white">{INN}</strong></p>}
        <p>Юридический / фактический адрес: <strong className="text-white">{ADDRESS}</strong></p>
        <p>Электронная почта: <a href={`mailto:${EMAIL}`} className="text-green-400 hover:underline">{EMAIL}</a></p>
        <p>Телефон: <strong className="text-white">{PHONE}</strong></p>
        {MANAGER && (
          <p>Служба поддержки (Telegram): <a href={`https://t.me/${MANAGER.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{MANAGER}</a></p>
        )}
        {CHANNEL && (
          <p>Официальный канал: <a href={CHANNEL} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{CHANNEL}</a></p>
        )}
      </Section>

      <Section title="Условия оказания услуги (доставка)">
        <p>KaraShop оказывает исключительно <strong className="text-white">цифровые услуги</strong> — профессиональный бустинг игровых аккаунтов. Физическая доставка товаров не осуществляется.</p>
        <p><strong className="text-white">Способ оказания:</strong> услуга выполняется специалистом дистанционно, в игровом аккаунте клиента.</p>
        <p><strong className="text-white">Срок:</strong> начало работы — в течение 2 часов после подтверждения оплаты. Итоговые сроки зависят от выбранной услуги и указаны в описании каждой позиции.</p>
        <p><strong className="text-white">Регион:</strong> услуги оказываются для пользователей из любой страны без ограничений по географии.</p>
        <p><strong className="text-white">Стоимость:</strong> указана в каталоге на сайте. Скрытых комиссий нет.</p>
      </Section>

      <Section title="Условия возврата и отмены платежа">
        <p><strong className="text-white">До начала выполнения</strong> — полный возврат средств по запросу клиента.</p>
        <p><strong className="text-white">После начала выполнения</strong> — возврат не производится, так как ресурсы специалиста уже задействованы.</p>
        <p><strong className="text-white">Если выполнение невозможно по вине Сервиса</strong> — полный возврат в течение 5 рабочих дней.</p>
        <p><strong className="text-white">Для оформления возврата</strong> обратитесь в поддержку: <a href={`mailto:${EMAIL}`} className="text-green-400 hover:underline">{EMAIL}</a>{MANAGER && <> или <a href={`https://t.me/${MANAGER.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{MANAGER}</a></>}.</p>
        <p>Возврат осуществляется тем же способом, которым была произведена оплата, в сроки, установленные платёжной системой.</p>
      </Section>

      <Section title="Лицензия и интеллектуальная собственность">
        <p>Сервис KaraShop оказывает <strong className="text-white">услуги по управлению игровым аккаунтом</strong> на основании предоставленных клиентом данных доступа. Реализация продуктов третьих лиц не осуществляется.</p>
        <p>Все игры, упомянутые в каталоге, являются собственностью соответствующих правообладателей. KaraShop не претендует на права на игровой контент и не реализует его как товар.</p>
        <p>Оказываемые услуги представляют собой <strong className="text-white">труд специалиста</strong> (игрока), а не продажу цифровых товаров или программного обеспечения.</p>
        <p>Сервис осознаёт, что ускоренное прохождение игр может противоречить пользовательским соглашениям отдельных игр. Клиент принимает данный риск самостоятельно, что подтверждается <a href="/offer" className="text-green-400 hover:underline">договором оферты</a>.</p>
      </Section>

    </LegalPage>
  )
}
