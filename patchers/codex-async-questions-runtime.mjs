// Generated from the maintained VS Code source patch. Keep behavior and tests aligned.
export function createAsyncQuestionsController({ generateUuid, buildUserInputRequest, answerStrings }) {
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/** Keeps question controls alive until answered without blocking Codex's native turn. */
return class CodexAsyncQuestions {
    host;
    requests = new Map();
    seen = new Set();
    completion;
    sending = 0;
    deliveries = new Set();
    generation = 0;
    constructor(host) {
        this.host = host;
    }
    /** Publishes one carousel per item; replayed start events cannot ask twice. */
    ask(itemId, questions) {
        if (!questions.length || this.seen.has(itemId)) {
            return;
        }
        this.seen.add(itemId);
        this.show(questions);
    }
    show(questions) {
        const id = generateUuid();
        this.requests.set(id, questions);
        this.host.show(buildUserInputRequest(id, questions.map((question, index) => ({
            id: String(index), header: '', question: question.title, isOther: true, isSecret: false,
            options: question.options?.map(label => ({ label, description: '' })) ?? null,
        }))));
    }
    /** A new native turn supersedes a held completion, retaining outstanding questions. */
    turnStarted(turnId) {
        if (this.completion?.turn.id !== turnId) {
            this.completion = undefined;
        }
    }
    /** Hold only successful completion so the existing active-turn carousel stays usable. */
    holdCompletion(completion) {
        if (completion.turn.status === 'completed' && (this.requests.size > 0 || this.sending > 0)) {
            this.completion = completion;
            return true;
        }
        this.clear();
        return false;
    }
    /** Consumes explicit answers; skipping never submits a suggested option. */
    respond(id, response, answers) {
        const questions = this.requests.get(id);
        if (!questions) {
            return false;
        }
        this.requests.delete(id);
        const text = questions.flatMap((question, index) => {
            const values = answerStrings(answers?.[String(index)], response);
            if (!values.length) {
                return [];
            }
            const title = Array.from(question.title).slice(0, 512).join('').replace(/[\r\n]/g, ' ');
            return [`> ${title}\n\n${values.join('\n')}`];
        }).join('\n\n');
        if (text) {
            const delivery = this.deliver(questions, text);
            this.deliveries.add(delivery);
            void delivery.finally(() => this.deliveries.delete(delivery));
        }
        else {
            this.flush();
        }
        return true;
    }
    /** Failed delivery reopens the questions instead of silently losing an accepted answer. */
    async deliver(questions, text) {
        const generation = this.generation;
        this.sending++;
        try {
            const turnId = await this.host.send(text);
            if (generation === this.generation) {
                this.turnStarted(turnId);
            }
        }
        catch (error) {
            if (generation === this.generation) {
                this.host.reportError(error);
                this.show(questions);
            }
        }
        finally {
            if (generation === this.generation) {
                this.sending--;
                this.flush();
            }
        }
    }
    flush() {
        if (this.requests.size === 0 && this.sending === 0 && this.completion) {
            const completion = this.completion;
            this.completion = undefined;
            this.host.finish(completion);
        }
    }
    /** Waits for already-sent RPCs so Stop can interrupt the actual continuation turn. */
    async whenIdle() {
        await Promise.all(this.deliveries);
    }
    /** Cancels stale controls and invalidates in-flight callbacks on stop, replacement or disposal. */
    clear() {
        const completion = this.completion;
        this.completion = undefined;
        this.generation++;
        this.sending = 0;
        const ids = [...this.requests.keys()];
        this.requests.clear();
        this.seen.clear();
        for (const id of ids) {
            this.host.cancel(id);
        }
        return completion;
    }
}

}
