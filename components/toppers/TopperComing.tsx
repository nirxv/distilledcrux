import { TOPPER_SUBJECTS, TOPPER_SUBJECT_NAME } from '@/lib/toppers/meta';

/**
 * For a reader whose optional has no copies yet: theirs are coming, and what
 * they will be. Shown on the copies of the optionals that have them, where
 * such a reader lands, in place of the pass they could not use.
 */
export default function TopperComing({ optional }: { optional: string }) {
  const live = TOPPER_SUBJECTS.map((s) => TOPPER_SUBJECT_NAME[s]).join(' and ');
  return (
    <div className="tco">
      <span className="tco-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12.5c1.2-1 2.2-1 3 0s1.8 1 3 0M9 16.5c1.2-1 2.2-1 3 0" /></svg>
      </span>
      <div className="tco-body">
        <p className="tco-top">
          <strong className="tco-title">{optional} topper copies</strong>
          <span className="tco-tag">Coming</span>
        </p>
        <p className="tco-text">
          Handwritten answers by {optional} rankers, filed under the UPSC questions they answer, like the {live} copies here.
          Premium for {optional} will include them.
        </p>
      </div>
    </div>
  );
}
