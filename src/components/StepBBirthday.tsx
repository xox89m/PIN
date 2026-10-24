import React, { useMemo, useState } from 'react';
import { TARGET_BIRTHDAY } from '../config';
import { THAI_MONTHS, UI_COPY } from '../content/letters';
import { Calendar, ArrowLeft } from 'lucide-react';

interface StepBBirthdayProps {
  onBack: () => void;
  onVerified: () => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function StepBBirthday({ onBack, onVerified }: StepBBirthdayProps) {
  const [selectedDay, setSelectedDay] = useState<number>(28);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2005);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = TARGET_BIRTHDAY.minYear; y <= TARGET_BIRTHDAY.maxYear; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const maxDayInCurrentMonth = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  const days = useMemo(() => {
    const safeMax = Math.max(28, maxDayInCurrentMonth);
    return Array.from({ length: safeMax }, (_, i) => i + 1);
  }, [maxDayInCurrentMonth]);

  const handleMonthChange = (newMonth: number) => {
    setSelectedMonth(newMonth);
    setErrorMessage('');
    const maxD = getDaysInMonth(selectedYear, newMonth);
    if (selectedDay > maxD) {
      setSelectedDay(maxD);
    }
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    setErrorMessage('');
    const maxD = getDaysInMonth(newYear, selectedMonth);
    if (selectedDay > maxD) {
      setSelectedDay(maxD);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      selectedDay === TARGET_BIRTHDAY.day &&
      selectedMonth === TARGET_BIRTHDAY.month &&
      selectedYear === TARGET_BIRTHDAY.year
    ) {
      setErrorMessage('');
      onVerified();
    } else {
      setErrorMessage(UI_COPY.stepB.wrongDateMessage);
    }
  };

  return (
    <section className="w-full max-w-xl mx-auto px-5 py-6 flex flex-col min-h-[78vh]">
      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{UI_COPY.stepB.backBtn}</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col items-center justify-center space-y-7 py-8"
      >
        <div className="inline-flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#F0D5A8]" aria-hidden="true" />
          <h1
            className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
            style={{ textWrap: 'balance' }}
          >
            {UI_COPY.stepB.question}
          </h1>
        </div>

        {/* แถวตัวเลือก วัน / เดือน / ปี ทรงแคปซูลโปร่งแสงตามภาพอ้างอิง */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-md">
          <div>
            <label htmlFor="bday-day" className="sr-only">
              วันที่
            </label>
            <select
              id="bday-day"
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(Number(e.target.value));
                setErrorMessage('');
              }}
              className="w-full min-h-[46px] px-3.5 py-2 bg-[#1B1511]/80 backdrop-blur-md border border-[#E8DDD0]/45 rounded-full text-sm sm:text-base text-[#F6EFE6] tabular-nums focus:outline-none focus:border-[#F6EFE6] cursor-pointer"
            >
              {days.map((d) => (
                <option key={d} value={d} className="bg-[#1E1712] text-[#F6EFE6]">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bday-month" className="sr-only">
              เดือน
            </label>
            <select
              id="bday-month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full min-h-[46px] px-3.5 py-2 bg-[#1B1511]/80 backdrop-blur-md border border-[#E8DDD0]/45 rounded-full text-sm sm:text-base text-[#F6EFE6] focus:outline-none focus:border-[#F6EFE6] cursor-pointer"
            >
              {THAI_MONTHS.map((m) => (
                <option
                  key={m.value}
                  value={m.value}
                  className="bg-[#1E1712] text-[#F6EFE6]"
                >
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="bday-year" className="sr-only">
              ปี ค.ศ.
            </label>
            <select
              id="bday-year"
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full min-h-[46px] px-3.5 py-2 bg-[#1B1511]/80 backdrop-blur-md border border-[#E8DDD0]/45 rounded-full text-sm sm:text-base text-[#F6EFE6] tabular-nums focus:outline-none focus:border-[#F6EFE6] cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#1E1712] text-[#F6EFE6]">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-[#E8DDD0]/70">
          รองรับการเลือกปี ค.ศ. {TARGET_BIRTHDAY.minYear} – {TARGET_BIRTHDAY.maxYear}
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="max-w-md px-5 py-3.5 rounded-2xl bg-[#381814]/85 backdrop-blur-md border border-[#E5988E]/50 text-sm text-[#FADCD8] text-center leading-relaxed"
          >
            {errorMessage}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            className="night-glass-btn min-w-[150px] min-h-[48px] px-9 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {UI_COPY.stepB.submitBtn}
          </button>
        </div>
      </form>
    </section>
  );
}
